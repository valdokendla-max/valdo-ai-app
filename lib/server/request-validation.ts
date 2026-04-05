import { z } from 'zod'

export class RequestValidationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'RequestValidationError'
    this.status = status
  }
}

function formatZodIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
      return `${path}${issue.message}`
    })
    .join('; ')
}

export async function parseJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>,
  options: {
    maxBytes: number
    emptyBodyMessage?: string
  }
) {
  const contentLength = req.headers.get('content-length')

  if (contentLength) {
    const parsedLength = Number(contentLength)

    if (Number.isFinite(parsedLength) && parsedLength > options.maxBytes) {
      throw new RequestValidationError('Päringu body on liiga suur.', 413)
    }
  }

  const rawBody = await req.text()

  if (!rawBody.trim()) {
    throw new RequestValidationError(options.emptyBodyMessage || 'Päringu body puudub.')
  }

  if (Buffer.byteLength(rawBody, 'utf8') > options.maxBytes) {
    throw new RequestValidationError('Päringu body on liiga suur.', 413)
  }

  let parsedBody: unknown

  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    throw new RequestValidationError('Päringu JSON on vigane.')
  }

  const result = schema.safeParse(parsedBody)

  if (!result.success) {
    throw new RequestValidationError(formatZodIssues(result.error))
  }

  return result.data
}

export function createValidationErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof RequestValidationError) {
    return Response.json({ error: error.message }, { status: error.status })
  }

  return Response.json({ error: fallbackMessage }, { status: 500 })
}