import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import { PDFDocument, StandardFonts } from 'pdf-lib'

export type ArtifactEncoding = 'text' | 'base64'

export type ChatArtifact = {
  id: string
  name: string
  mime: string
  encoding: ArtifactEncoding
  content: string
}

const ARTIFACT_BLOCK_REGEX = /<artifact\s+([^>]+)>([\s\S]*?)<\/artifact>/gi
const PDF_MIME = 'application/pdf'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

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

type RichTextBlock =
  | { type: 'blank'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'heading'; text: string; level: 1 | 2 | 3 }

function getArtifactExtension(name: string) {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

function parseRichTextBlocks(content: string): RichTextBlock[] {
  return normalizeArtifactContent(content)
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .map((line) => {
      const trimmed = line.trim()

      if (!trimmed) {
        return { type: 'blank', text: '' } as const
      }

      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/)

      if (headingMatch) {
        return {
          type: 'heading',
          level: headingMatch[1].length as 1 | 2 | 3,
          text: headingMatch[2].trim(),
        } as const
      }

      if (/^[-*]\s+/.test(trimmed)) {
        return { type: 'bullet', text: trimmed.replace(/^[-*]\s+/, '') } as const
      }

      return { type: 'paragraph', text: trimmed } as const
    })
}

function needsPdfCompilation(artifact: ChatArtifact) {
  return artifact.mime === PDF_MIME || getArtifactExtension(artifact.name) === 'pdf'
}

function needsDocxCompilation(artifact: ChatArtifact) {
  return artifact.mime === DOCX_MIME || getArtifactExtension(artifact.name) === 'docx'
}

function wrapPdfLine(text: string, maxWidth: number, font: PDFFontLike, fontSize: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word

    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      currentLine = candidate
      continue
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    currentLine = word
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.length > 0 ? lines : ['']
}

type PDFFontLike = {
  widthOfTextAtSize: (text: string, size: number) => number
}

async function createPdfBlob(artifact: ChatArtifact) {
  const document = await PDFDocument.create()
  const regularFont = await document.embedFont(StandardFonts.Helvetica)
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold)
  const pageSize: [number, number] = [595.28, 841.89]
  const margin = 50
  const maxWidth = pageSize[0] - margin * 2
  const blocks = parseRichTextBlocks(artifact.content)
  let page = document.addPage(pageSize)
  let y = pageSize[1] - margin

  const ensureRoom = (requiredHeight: number) => {
    if (y - requiredHeight >= margin) {
      return
    }

    page = document.addPage(pageSize)
    y = pageSize[1] - margin
  }

  for (const block of blocks) {
    if (block.type === 'blank') {
      y -= 10
      continue
    }

    const isHeading = block.type === 'heading'
    const fontSize = isHeading ? (block.level === 1 ? 18 : block.level === 2 ? 15 : 13) : 11.5
    const lineHeight = fontSize * 1.35
    const font = isHeading ? boldFont : regularFont
    const prefix = block.type === 'bullet' ? '• ' : ''
    const lines = wrapPdfLine(`${prefix}${block.text}`, maxWidth, font, fontSize)

    ensureRoom(lines.length * lineHeight + 6)

    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
      })
      y -= lineHeight
    }

    y -= isHeading ? 4 : 2
  }

  const bytes = await document.save()
  return new Blob([bytes], { type: PDF_MIME })
}

function createDocxParagraph(block: RichTextBlock) {
  if (block.type === 'blank') {
    return new Paragraph({ spacing: { after: 140 } })
  }

  if (block.type === 'heading') {
    const heading =
      block.level === 1
        ? HeadingLevel.HEADING_1
        : block.level === 2
          ? HeadingLevel.HEADING_2
          : HeadingLevel.HEADING_3

    return new Paragraph({
      heading,
      spacing: { before: 200, after: 120 },
      children: [new TextRun(block.text)],
    })
  }

  if (block.type === 'bullet') {
    return new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 80 },
      children: [new TextRun(block.text)],
    })
  }

  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun(block.text)],
  })
}

async function createDocxBlob(artifact: ChatArtifact) {
  const document = new Document({
    sections: [
      {
        properties: {},
        children: parseRichTextBlocks(artifact.content).map(createDocxParagraph),
      },
    ],
  })

  const blob = await Packer.toBlob(document)
  return new Blob([blob], { type: DOCX_MIME })
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

export async function createArtifactBlob(artifact: ChatArtifact) {
  if (needsPdfCompilation(artifact)) {
    return createPdfBlob(artifact)
  }

  if (needsDocxCompilation(artifact)) {
    return createDocxBlob(artifact)
  }

  if (artifact.encoding === 'base64') {
    const binary = atob(artifact.content)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return new Blob([bytes], { type: artifact.mime })
  }

  return new Blob([artifact.content], { type: artifact.mime })
}