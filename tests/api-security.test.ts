import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { POST as chatPost } from '@/app/api/chat/route'
import { POST as imagePost } from '@/app/api/image/route'
import { GET as knowledgeGet, POST as knowledgePost } from '@/app/api/knowledge/route'
import { KnowledgeStore } from '@/lib/knowledge-store'
import { KNOWLEDGE_ADMIN_HEADER } from '@/lib/knowledge'

test('knowledge GET rejects requests without admin token', async () => {
  process.env.KNOWLEDGE_ADMIN_TOKEN = 'test-admin-token'

  const response = await knowledgeGet(new Request('http://localhost/api/knowledge'))
  const data = await response.json()

  assert.equal(response.status, 401)
  assert.match(String(data.error), /admin-token puudub/i)
})

test('knowledge POST rejects wrong admin token', async () => {
  process.env.KNOWLEDGE_ADMIN_TOKEN = 'test-admin-token'

  const response = await knowledgePost(
    new Request('http://localhost/api/knowledge', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [KNOWLEDGE_ADMIN_HEADER]: 'wrong-token',
      },
      body: JSON.stringify({
        title: 'Test',
        content: 'Sisu',
        category: 'fakt',
      }),
    })
  )
  const data = await response.json()

  assert.equal(response.status, 403)
  assert.match(String(data.error), /vale/i)
})

test('chat POST returns 400 for schema-invalid payload', async () => {
  const response = await chatPost(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messages: [],
      }),
    })
  )
  const data = await response.json()

  assert.equal(response.status, 400)
  assert.match(String(data.error), /messages/i)
})

test('image POST returns 400 for missing prompt in generate mode', async () => {
  const response = await imagePost(
    new Request('http://localhost/api/image', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generate',
      }),
    })
  )
  const data = await response.json()

  assert.equal(response.status, 400)
  assert.match(String(data.error), /prompt/i)
})

test('image POST rejects prompts that reference minors', async () => {
  const response = await imagePost(
    new Request('http://localhost/api/image', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generate',
        prompt: 'create a detailed portrait of a teenage girl',
      }),
    })
  )
  const data = await response.json()

  assert.equal(response.status, 400)
  assert.match(String(data.error), /alaealis|minor/i)
})

test('image POST rejects illegal sexual violence prompts', async () => {
  const response = await imagePost(
    new Request('http://localhost/api/image', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        action: 'generate',
        prompt: 'create a non-consensual explicit scene',
      }),
    })
  )
  const data = await response.json()

  assert.equal(response.status, 400)
  assert.match(String(data.error), /keelatud|ebaseaduslik|illegal/i)
})

test('KnowledgeStore persists items to file fallback', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'valdo-knowledge-store-'))
  const filePath = path.join(tempDir, 'knowledge-store.json')

  try {
    delete process.env.KV_REST_API_URL
    delete process.env.KV_REST_API_TOKEN
    delete process.env.VERCEL

    const firstStore = new KnowledgeStore({
      filePath,
      storageKey: 'test-knowledge-items',
    })

    const created = await firstStore.add({
      title: 'Pusiv test',
      content: 'Kirje peab j22ma faili alles.',
      category: 'fakt',
    })

    assert.ok(created.id)

    const fileContents = JSON.parse(await readFile(filePath, 'utf8')) as Array<{ title: string }>
    assert.ok(fileContents.some((item) => item.title === 'Pusiv test'))

    const secondStore = new KnowledgeStore({
      filePath,
      storageKey: 'test-knowledge-items',
    })
    const items = await secondStore.getAll()

    assert.ok(items.some((item) => item.title === 'Pusiv test'))
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
