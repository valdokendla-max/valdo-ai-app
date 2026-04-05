'use client'

import type { UIMessage } from 'ai'
import JSZip from 'jszip'
import { Bot, Download, FileArchive, FileText, ImageDown, User } from 'lucide-react'
import NextImage from 'next/image'
import { memo, useMemo } from 'react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { createArtifactBlob, extractChatArtifacts, type ChatArtifact } from '@/lib/chat-artifacts'
import { cn } from '@/lib/utils'

function getMessageText(message: UIMessage): string {
  if (!message.parts || !Array.isArray(message.parts)) return ''
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function allowGeneratedImageUrls(url: string) {
  if (url.startsWith('data:image/')) {
    return url
  }

  return defaultUrlTransform(url)
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

async function downloadArtifactsAsZip(artifacts: ChatArtifact[]) {
  const zip = new JSZip()

  for (const artifact of artifacts) {
    const blob = await createArtifactBlob(artifact)
    zip.file(artifact.name, await blob.arrayBuffer())
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  triggerBrowserDownload(blob, 'valdo-artifacts.zip')
}

async function downloadImageFile(src: string, filenameBase: string, mimeType: 'image/png' | 'image/jpeg') {
  if (!src) {
    return
  }

  const extension = mimeType === 'image/png' ? 'png' : 'jpg'

  if (src.startsWith('data:') && src.startsWith(`data:${mimeType}`)) {
    const response = await fetch(src)
    const blob = await response.blob()
    triggerBrowserDownload(blob, `${filenameBase}.${extension}`)
    return
  }

  const image = new Image()
  image.decoding = 'async'
  image.src = src

  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
  })

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas context puudub.')
  }

  context.drawImage(image, 0, 0)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, mimeType, mimeType === 'image/jpeg' ? 0.94 : undefined)
  })

  if (!blob) {
    throw new Error('Pildi allalaadimine ebaõnnestus.')
  }

  triggerBrowserDownload(blob, `${filenameBase}.${extension}`)
}

function ArtifactPanel({ artifacts }: { artifacts: ChatArtifact[] }) {
  return (
    <div className="mt-3 rounded-xl border border-border/70 bg-secondary/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-foreground">
          <FileText className="h-4 w-4 text-primary" />
          <span>Loodud failid</span>
        </div>
        {artifacts.length > 1 ? (
          <button
            type="button"
            onClick={() => void downloadArtifactsAsZip(artifacts)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
          >
            <FileArchive className="h-3.5 w-3.5" />
            Laadi ZIP
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {artifacts.map((artifact) => (
          <div
            key={artifact.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm text-foreground">{artifact.name}</div>
              <div className="text-[11px] text-muted-foreground">{artifact.mime}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                void createArtifactBlob(artifact).then((blob) => {
                  triggerBrowserDownload(blob, artifact.name)
                })
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
            >
              <Download className="h-3.5 w-3.5" />
              Laadi alla
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function MarkdownImage({ src, alt }: { src: string; alt?: string }) {
  const filenameBase = (alt || 'valdo-image').toLowerCase().replace(/[^a-z0-9-_]+/gi, '-') || 'valdo-image'

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border/70 bg-background/40">
      <NextImage
        src={src}
        alt={alt || 'Loodud pilt'}
        width={1024}
        height={1024}
        unoptimized
        className="max-h-128 h-auto w-full object-cover"
      />
      <div className="flex flex-wrap gap-2 border-t border-border/60 px-3 py-2">
        <button
          type="button"
          onClick={() => void downloadImageFile(src, filenameBase, 'image/png')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
        >
          <ImageDown className="h-3.5 w-3.5" />
          PNG
        </button>
        <button
          type="button"
          onClick={() => void downloadImageFile(src, filenameBase, 'image/jpeg')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
        >
          <ImageDown className="h-3.5 w-3.5" />
          JPG
        </button>
      </div>
    </div>
  )
}

export const ChatMessage = memo(
  function ChatMessage({ message }: { message: UIMessage }) {
    const isUser = message.role === 'user'
    const text = useMemo(() => getMessageText(message), [message])
    const { body, artifacts } = useMemo(() => extractChatArtifacts(text), [text])

    return (
      <div
        className={cn(
          'flex gap-3 px-4 py-3',
          isUser ? 'justify-end' : 'justify-start'
        )}
      >
        {!isUser && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
        )}
        <div
          className={cn(
            'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-card-foreground border border-border'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{text}</p>
          ) : (
            <>
              {body ? (
                <div className="prose prose-invert prose-sm max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_pre]:bg-secondary [&_pre]:p-3 [&_pre]:rounded-lg [&_code]:text-primary [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_a]:text-primary [&_a]:underline [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-1 [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    urlTransform={allowGeneratedImageUrls}
                    components={{
                      img: ({ src, alt }) =>
                        src ? <MarkdownImage src={String(src)} alt={alt} /> : null,
                    }}
                  >
                    {body}
                  </ReactMarkdown>
                </div>
              ) : null}
              {artifacts.length > 0 ? <ArtifactPanel artifacts={artifacts} /> : null}
            </>
          )}
        </div>
        {isUser && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
            <User className="h-4 w-4" />
          </div>
        )}
      </div>
    )
  },
  (previousProps, nextProps) => {
    if (previousProps.message.id !== nextProps.message.id) {
      return false
    }

    if (previousProps.message.role !== nextProps.message.role) {
      return false
    }

    return getMessageText(previousProps.message) === getMessageText(nextProps.message)
  }
)
