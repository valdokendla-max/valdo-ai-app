export type ArtifactEncoding = 'text' | 'base64'

export type ChatArtifact = {
  id: string
  name: string
  mime: string
  encoding: ArtifactEncoding
  content: string
}

const ARTIFACT_BLOCK_REGEX = /<artifact\s+([^>]+)>([\s\S]*?)<\/artifact>/gi

function parseArtifactAttributes(input: string) {
  const attributes: Record<string, string> = {}

  for (const match of input.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) {
    attributes[match[1]] = match[2]
  }

  return attributes
}

function normalizeArtifactContent(content: string) {
  return content.replace(/^\n+/, '').replace(/\n+$/, '')
}

export function extractChatArtifacts(messageText: string) {
  const artifacts: ChatArtifact[] = []

  const body = messageText.replace(ARTIFACT_BLOCK_REGEX, (_fullMatch, rawAttributes, rawContent) => {
    const attributes = parseArtifactAttributes(rawAttributes)
    const name = attributes.name?.trim()
    const mime = attributes.mime?.trim()

    if (!name || !mime) {
      return _fullMatch
    }

    artifacts.push({
      id: `${name}-${artifacts.length}`,
      name,
      mime,
      encoding: attributes.encoding === 'base64' ? 'base64' : 'text',
      content: normalizeArtifactContent(rawContent),
    })

    return ''
  })

  return {
    body: body.replace(/\n{3,}/g, '\n\n').trim(),
    artifacts,
  }
}

export function createArtifactBlob(artifact: ChatArtifact) {
  if (artifact.encoding === 'base64') {
    const binary = atob(artifact.content)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return new Blob([bytes], { type: artifact.mime })
  }

  return new Blob([artifact.content], { type: artifact.mime })
}