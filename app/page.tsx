'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import { DefaultChatTransport } from 'ai'
import { ChatHeader } from '@/components/chat-header'
import { ChatMessage } from '@/components/chat-message'
import { ChatInput } from '@/components/chat-input'
import { ChatWelcome } from '@/components/chat-welcome'
import { KnowledgePanel } from '@/components/knowledge-panel'

type ImageJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'not_found'

type ImageStatusResponse = {
  status: ImageJobStatus
  imageDataUrl?: string
  error?: string
}

function createTextMessage(role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [{ type: 'text', text }],
  }
}

function buildImageStatusText(prompt: string, status: Exclude<ImageJobStatus, 'succeeded'>) {
  switch (status) {
    case 'queued':
      return `Pildi loomine on järjekorras: **${prompt}**`
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

export default function ValdoAI() {
  const [input, setInput] = useState('')
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [isImageMode, setIsImageMode] = useState(false)
  const [imageError, setImageError] = useState<string | undefined>()
  const [isImageLoading, setIsImageLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, setMessages, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const isBusy = isLoading || isImageLoading
  const displayError = imageError || error?.message

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isImageLoading])

  const handleTextSubmit = () => {
    if (!input.trim() || isBusy) return
    setImageError(undefined)
    sendMessage({ text: input })
    setInput('')
  }

  const replaceMessageText = (messageId: string, text: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, parts: [{ type: 'text', text }] } : message
      )
    )
  }

  const pollImageJob = async (promptId: string, placeholderId: string, prompt: string) => {
    for (let attempt = 0; attempt < 90; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 4000))

      const response = await fetch(`/api/image?promptId=${encodeURIComponent(promptId)}`, {
        cache: 'no-store',
      })

      const data = (await response.json()) as ImageStatusResponse

      if (!response.ok) {
        throw new Error(data.error || 'Pildi oleku kontroll ebaõnnestus.')
      }

      if (data.status === 'succeeded' && data.imageDataUrl) {
        const assistantMessage = createTextMessage(
          'assistant',
          `Loodud pilt promptist: **${prompt}**\n\n![Loodud pilt](${data.imageDataUrl})`
        )

        setMessages((current) =>
          current.map((message) =>
            message.id === placeholderId ? assistantMessage : message
          )
        )
        return
      }

      if (data.status === 'failed') {
        throw new Error(data.error || 'Pildi loomine ebaõnnestus.')
      }

      if (data.status === 'not_found' && attempt > 5) {
        throw new Error('ComfyUI ei leidnud enam seda tööd üles.')
      }

      if (data.status === 'queued' || data.status === 'running' || data.status === 'not_found') {
        replaceMessageText(placeholderId, buildImageStatusText(prompt, data.status))
      }
    }

    throw new Error('Pildi loomine võtab liiga kaua aega. Kontrolli hiljem uuesti.')
  }

  const handleImageSubmit = async () => {
    const prompt = input.trim()

    if (!prompt || isBusy) return

    const userMessage = createTextMessage('user', prompt)
    const placeholderMessage = createTextMessage(
      'assistant',
      buildImageStatusText(prompt, 'queued')
    )

    setImageError(undefined)
    setIsImageLoading(true)
    setInput('')
    setMessages((current) => [...current, userMessage, placeholderMessage])

    try {
      const response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Pildi loomine ebaõnnestus.')
      }

      if (data.imageDataUrl) {
        const assistantMessage = createTextMessage(
          'assistant',
          `Loodud pilt promptist: **${prompt}**\n\n![Loodud pilt](${data.imageDataUrl})`
        )

        setMessages((current) =>
          current.map((message) =>
            message.id === placeholderMessage.id ? assistantMessage : message
          )
        )
        return
      }

      if (!data.promptId) {
        throw new Error('Pilditöö ei tagastanud töö ID-d.')
      }

      await pollImageJob(data.promptId, placeholderMessage.id, prompt)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pildi loomine ebaõnnestus.'
      setImageError(message)
      setMessages((current) =>
        current.map((entry) =>
          entry.id === placeholderMessage.id
            ? createTextMessage('assistant', `Pildi loomine ebaõnnestus: ${message}`)
            : entry
        )
      )
    } finally {
      setIsImageLoading(false)
    }
  }

  const handleSubmit = () => {
    if (isImageMode) {
      void handleImageSubmit()
      return
    }

    handleTextSubmit()
  }

  const handleSuggestionClick = (text: string) => {
    if (text.toLowerCase().startsWith('loo pilt')) {
      setIsImageMode(true)
      setInput(text)
      return
    }

    setImageError(undefined)
    sendMessage({ text })
  }

  const handleReset = () => {
    setMessages([])
    setImageError(undefined)
    setIsImageLoading(false)
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ChatHeader hasMessages={messages.length > 0} onReset={handleReset} onOpenKnowledge={() => setKnowledgeOpen(true)} />
      <KnowledgePanel isOpen={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <ChatWelcome onSuggestionClick={handleSuggestionClick} />
        ) : (
          <div className="mx-auto max-w-3xl py-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {isBusy && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            {displayError && (
              <div className="px-4 py-3">
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {displayError}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        onSubmit={handleSubmit}
        isLoading={isBusy}
        error={displayError}
        isImageMode={isImageMode}
        onToggleImageMode={() => {
          setImageError(undefined)
          setIsImageMode((current) => !current)
        }}
      />
    </div>
  )
}
