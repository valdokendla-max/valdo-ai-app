import type { UIMessage } from 'ai'

export type ImageJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'not_found'

export type ChatStreamEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'finish' }
  | { type: string; [key: string]: unknown }

export const GENERATED_IMAGE_MARKDOWN_REGEX = /!\[[^\]]*\]\(data:image\/[^)]+\)/g
export const PUBLIC_HOST = 'valdo-ai-webapp.vercel.app'
export const PROTECTED_HOSTS = new Set([
  'valdo-ai-webapp-valdos-projects-48d5db42.vercel.app',
  'valdo-ai-webapp-git-main-valdos-projects-48d5db42.vercel.app',
])

export function resolveClientApiPath(path: string) {
  if (typeof window === 'undefined') {
    return path
  }

  if (!PROTECTED_HOSTS.has(window.location.host)) {
    return path
  }

  return `https://${PUBLIC_HOST}${path}`
}

export function createTextMessage(role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [{ type: 'text', text }],
  }
}

export function sanitizeMessagesForChatModel(messages: UIMessage[]) {
  return messages.map((message) => ({
    ...message,
    parts: message.parts?.map((part) => {
      if (part.type !== 'text') {
        return part
      }

      return {
        ...part,
        text: part.text.replace(
          GENERATED_IMAGE_MARKDOWN_REGEX,
          '[Genereeritud pilt jäeti tekstimudeli kontekstist välja.]'
        ),
      }
    }),
  }))
}

export function buildImageStatusText(
  prompt: string,
  status: Exclude<ImageJobStatus, 'succeeded'> | 'starting'
) {
  switch (status) {
    case 'starting':
      return `Saadan pildi loomise töötlusse: **${prompt}**`
    case 'queued':
      return `Pildi loomine valmistub: **${prompt}**`
    case 'running':
      return `Loon pilti promptist: **${prompt}**`
    case 'failed':
      return `Pildi loomine ebaõnnestus promptiga: **${prompt}**`
    case 'not_found':
      return `Pildi töö kadus järjekorrast enne valmimist: **${prompt}**`
    default:
      return 'Loon pilti...'
  }
}

export function serializeMessagesForStorage(messages: UIMessage[]) {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts:
      message.parts
        ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => ({
          type: 'text' as const,
          text: part.text.replace(
            GENERATED_IMAGE_MARKDOWN_REGEX,
            '[Genereeritud pilt eemaldati salvestatud vestlusest.]'
          ),
        })) ?? [],
  }))
}

export function parseStoredMessages(rawValue: string | null): UIMessage[] {
  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.flatMap((message) => {
      if (
        !message ||
        typeof message !== 'object' ||
        typeof message.id !== 'string' ||
        (message.role !== 'user' && message.role !== 'assistant' && message.role !== 'system') ||
        !Array.isArray(message.parts)
      ) {
        return []
      }

      const parts = message.parts.flatMap((part: unknown) => {
        if (
          !part ||
          typeof part !== 'object' ||
          (part as { type?: unknown }).type !== 'text' ||
          typeof (part as { text?: unknown }).text !== 'string'
        ) {
          return []
        }

        return [{ type: 'text' as const, text: (part as { text: string }).text }]
      })

      return [{ id: message.id, role: message.role, parts } satisfies UIMessage]
    })
  } catch {
    return []
  }
}