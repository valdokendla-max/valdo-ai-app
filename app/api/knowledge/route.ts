import { knowledgeStore } from '@/lib/knowledge-store'

export async function GET() {
  const items = knowledgeStore.getAll()
  return Response.json(items)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { title, content, category } = body

  if (!title || !content || !category) {
    return Response.json({ error: 'Pealkiri, sisu ja kategooria on kohustuslikud' }, { status: 400 })
  }

  const item = knowledgeStore.add({ title, content, category })
  return Response.json(item, { status: 201 })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    return Response.json({ error: 'ID on kohustuslik' }, { status: 400 })
  }

  knowledgeStore.remove(id)
  return Response.json({ success: true })
}
