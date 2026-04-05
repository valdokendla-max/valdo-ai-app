import { KNOWLEDGE_ADMIN_HEADER } from '@/lib/knowledge'
import { knowledgeStore } from '@/lib/knowledge-store'
import { knowledgeCreateSchema } from '@/lib/server/api-schemas'
import {
  createValidationErrorResponse,
  parseJsonBody,
} from '@/lib/server/request-validation'

function verifyKnowledgeAdminAccess(req: Request) {
  const expectedToken = process.env.KNOWLEDGE_ADMIN_TOKEN?.trim()

  if (!expectedToken) {
    return Response.json(
      { error: 'KNOWLEDGE_ADMIN_TOKEN puudub. Teadmistebaasi muutmine on keelatud.' },
      { status: 503 }
    )
  }

  const providedToken = req.headers.get(KNOWLEDGE_ADMIN_HEADER)?.trim()

  if (!providedToken) {
    return Response.json({ error: 'Teadmistebaasi admin-token puudub.' }, { status: 401 })
  }

  if (providedToken !== expectedToken) {
    return Response.json({ error: 'Teadmistebaasi admin-token on vale.' }, { status: 403 })
  }

  return null
}

export async function GET(req: Request) {
  const authError = verifyKnowledgeAdminAccess(req)

  if (authError) {
    return authError
  }

  const items = await knowledgeStore.getAll()
  return Response.json(items)
}

export async function POST(req: Request) {
  const authError = verifyKnowledgeAdminAccess(req)

  if (authError) {
    return authError
  }

  try {
    const { title, content, category } = await parseJsonBody(req, knowledgeCreateSchema, {
      maxBytes: 64 * 1024,
      emptyBodyMessage: 'Teadmistebaasi kirje body puudub.',
    })

    const item = await knowledgeStore.add({ title, content, category })
    return Response.json(item, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('KV_REST_API_URL')) {
      return Response.json({ error: error.message }, { status: 503 })
    }

    return createValidationErrorResponse(error, 'Teadmistebaasi kirje salvestamine ebaõnnestus.')
  }
}

export async function DELETE(req: Request) {
  const authError = verifyKnowledgeAdminAccess(req)

  if (authError) {
    return authError
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id || id.length > 200) {
    return Response.json({ error: 'ID on kohustuslik' }, { status: 400 })
  }

  let removed = false

  try {
    removed = await knowledgeStore.remove(id)
  } catch (error) {
    if (error instanceof Error && error.message.includes('KV_REST_API_URL')) {
      return Response.json({ error: error.message }, { status: 503 })
    }

    return Response.json({ error: 'Teadmistebaasi kirje kustutamine ebaõnnestus.' }, { status: 500 })
  }

  if (!removed) {
    return Response.json({ error: 'Kirjet ei leitud.' }, { status: 404 })
  }

  return Response.json({ success: true })
}
