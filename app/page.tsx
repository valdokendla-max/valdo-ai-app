'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import type { UIMessage } from 'ai'
import { DefaultChatTransport } from 'ai'
import { ChatHeader } from '@/components/chat-header'
import { ChatMessage } from '@/components/chat-message'
import { ChatInput } from '@/components/chat-input'
import { HubStatusBar } from '@/components/hub-status-bar'
import { ChatWelcome } from '@/components/chat-welcome'
import { KnowledgePanel } from '@/components/knowledge-panel'
import {
  DEFAULT_IMAGE_PIPELINE_ID,
  DEFAULT_IMAGE_PROVIDER_ID,
  DEFAULT_PROMPT_PROFILE_ID,
  DEFAULT_TEXT_MODEL_ID,
  type ImagePipelineId,
  type ImageProviderId,
  type PromptProfileId,
  type TextModelId,
} from '@/lib/ai-hub'

type ImageJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'not_found'
type DisplayImageStage = 'idle' | 'queued' | 'running' | 'enhancing' | 'done' | 'failed'

type ImageStatusResponse = {
  status: ImageJobStatus
  imageDataUrl?: string
  error?: string
}

type ImageGenerateResponse = {
  imageDataUrl?: string
  promptId?: string
  shouldUpscale?: boolean
  provider?: ImageProviderId
  error?: string
}

type BackendHealthResponse = {
  automatic1111: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
  comfyui: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
  replicate: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
}

const GENERATED_IMAGE_MARKDOWN_REGEX = /!\[[^\]]*\]\(data:image\/[^)]+\)/g
const HUB_SETTINGS_STORAGE_KEY = 'valdo-ai-hub-settings'

function createTextMessage(role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [{ type: 'text', text }],
  }
}

function sanitizeMessagesForChatModel(messages: UIMessage[]) {
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
  const [textModelId, setTextModelId] = useState<TextModelId>(DEFAULT_TEXT_MODEL_ID)
  const [promptProfileId, setPromptProfileId] = useState<PromptProfileId>(
    DEFAULT_PROMPT_PROFILE_ID
  )
  const [imageProviderId, setImageProviderId] = useState<ImageProviderId>(
    DEFAULT_IMAGE_PROVIDER_ID
  )
  const [imagePipelineId, setImagePipelineId] = useState<ImagePipelineId>(
    DEFAULT_IMAGE_PIPELINE_ID
  )
  const [enhancePrompt, setEnhancePrompt] = useState(true)
  const [imageStage, setImageStage] = useState<DisplayImageStage>('idle')
  const [backendHealth, setBackendHealth] = useState<BackendHealthResponse | null>(null)
  const [activeImageProviderId, setActiveImageProviderId] = useState<ImageProviderId | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    const loadHealth = async () => {
      try {
        const response = await fetch('/api/backends/health', { cache: 'no-store' })
        const data = (await response.json()) as BackendHealthResponse

        if (!cancelled) {
          setBackendHealth(data)
        }
      } catch {
        if (!cancelled) {
          setBackendHealth(null)
        }
      }
    }

    void loadHealth()
    const timer = window.setInterval(() => {
      void loadHealth()
    }, 15000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const stored = window.localStorage.getItem(HUB_SETTINGS_STORAGE_KEY)

    if (!stored) {
      return
    }

    try {
      const parsed = JSON.parse(stored) as {
        textModelId?: TextModelId
        promptProfileId?: PromptProfileId
        imageProviderId?: ImageProviderId
        imagePipelineId?: ImagePipelineId
        enhancePrompt?: boolean
        isImageMode?: boolean
      }

      if (parsed.textModelId) setTextModelId(parsed.textModelId)
      if (parsed.promptProfileId) setPromptProfileId(parsed.promptProfileId)
      if (parsed.imageProviderId) setImageProviderId(parsed.imageProviderId)
      if (parsed.imagePipelineId) setImagePipelineId(parsed.imagePipelineId)
      if (typeof parsed.enhancePrompt === 'boolean') setEnhancePrompt(parsed.enhancePrompt)
      if (typeof parsed.isImageMode === 'boolean') setIsImageMode(parsed.isImageMode)
    } catch {
      window.localStorage.removeItem(HUB_SETTINGS_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      HUB_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        textModelId,
        promptProfileId,
        imageProviderId,
        imagePipelineId,
        enhancePrompt,
        isImageMode,
      })
    )
  }, [
    enhancePrompt,
    imagePipelineId,
    imageProviderId,
    isImageMode,
    promptProfileId,
    textModelId,
  ])

  const { messages, sendMessage, status, setMessages, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ id, messages, body, trigger, messageId }) => ({
        body: {
          ...body,
          id,
          messages: sanitizeMessagesForChatModel(messages),
          modelId: textModelId,
          promptProfileId,
          trigger,
          messageId,
        },
      }),
    }),
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

  const finalizeImageResult = async (
    prompt: string,
    placeholderId: string,
    imageDataUrl: string,
    shouldUpscale: boolean,
    pipelineId: ImagePipelineId
  ) => {
    let finalImageDataUrl = imageDataUrl

    if (shouldUpscale) {
      setImageStage('enhancing')
      replaceMessageText(placeholderId, `Täiustan loodud pilti: **${prompt}**`)

      const response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upscale',
          imageDataUrl,
          pipelineId,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.imageDataUrl) {
        throw new Error(data.error || 'Pildi täiustamine ebaõnnestus.')
      }

      finalImageDataUrl = data.imageDataUrl
    }

    const assistantMessage = createTextMessage(
      'assistant',
      `Loodud pilt promptist: **${prompt}**\n\n![Loodud pilt](${finalImageDataUrl})`
    )

    setMessages((current) =>
      current.map((message) => (message.id === placeholderId ? assistantMessage : message))
    )
    setImageStage('done')
  }

  const pollImageJob = async (
    promptId: string,
    placeholderId: string,
    prompt: string,
    shouldUpscale: boolean,
    pipelineId: ImagePipelineId
  ) => {
    for (let attempt = 0; attempt < 90; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 4000))

      const params = new URLSearchParams({ promptId })

      const response = await fetch(`/api/image?${params.toString()}`, {
        cache: 'no-store',
      })

      const data = (await response.json()) as ImageStatusResponse

      if (!response.ok) {
        throw new Error(data.error || 'Pildi oleku kontroll ebaõnnestus.')
      }

      if (data.status === 'succeeded' && data.imageDataUrl) {
        await finalizeImageResult(prompt, placeholderId, data.imageDataUrl, shouldUpscale, pipelineId)
        return
      }

      if (data.status === 'failed') {
        setImageStage('failed')
        throw new Error(data.error || 'Pildi loomine ebaõnnestus.')
      }

      if (data.status === 'not_found' && attempt > 5) {
        throw new Error('ComfyUI ei leidnud enam seda tööd üles.')
      }

      if (data.status === 'queued' || data.status === 'running' || data.status === 'not_found') {
        setImageStage(data.status === 'not_found' ? 'failed' : data.status)
        replaceMessageText(placeholderId, buildImageStatusText(prompt, data.status))
      }
    }

    throw new Error('Pildi loomine võtab liiga kaua aega. Kontrolli hiljem uuesti.')
  }

  const handleImageSubmit = async () => {
    const prompt = input.trim()
    const activePipelineId = imagePipelineId
    const activeEnhancePrompt = enhancePrompt

    if (!prompt || isBusy) return

    const userMessage = createTextMessage('user', prompt)
    const placeholderMessage = createTextMessage(
      'assistant',
      buildImageStatusText(prompt, 'queued')
    )

    setImageError(undefined)
    setIsImageLoading(true)
    setImageStage('queued')
    setActiveImageProviderId(imageProviderId === 'auto' ? null : imageProviderId)
    setInput('')
    setMessages((current) => [...current, userMessage, placeholderMessage])

    try {
      const response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          providerId: imageProviderId,
          pipelineId: activePipelineId,
          enhancePrompt: activeEnhancePrompt,
        }),
      })

      const data = (await response.json()) as ImageGenerateResponse

      if (!response.ok) {
        throw new Error(data.error || 'Pildi loomine ebaõnnestus.')
      }

      if (data.provider) {
        setActiveImageProviderId(data.provider)
      }

      if (data.imageDataUrl) {
        await finalizeImageResult(
          prompt,
          placeholderMessage.id,
          data.imageDataUrl,
          Boolean(data.shouldUpscale ?? activeEnhancePrompt),
          activePipelineId
        )
        return
      }

      if (!data.promptId) {
        throw new Error('Pilditöö ei tagastanud töö ID-d.')
      }

      await pollImageJob(
        data.promptId,
        placeholderMessage.id,
        prompt,
        Boolean(data.shouldUpscale ?? activeEnhancePrompt),
        activePipelineId
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Pildi loomine ebaõnnestus.'
      setImageStage('failed')
      setActiveImageProviderId(null)
      setImageError(undefined)
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
    setImageStage('idle')
    setActiveImageProviderId(null)
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ChatHeader hasMessages={messages.length > 0} onReset={handleReset} onOpenKnowledge={() => setKnowledgeOpen(true)} />
      <HubStatusBar
        isImageMode={isImageMode}
        textModelId={textModelId}
        promptProfileId={promptProfileId}
        imageProviderId={imageProviderId}
        activeImageProviderId={activeImageProviderId}
        imagePipelineId={imagePipelineId}
        enhancePrompt={enhancePrompt}
        imageStage={imageStage}
        backendHealth={backendHealth}
      />
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
        textModelId={textModelId}
        promptProfileId={promptProfileId}
        imageProviderId={imageProviderId}
        imagePipelineId={imagePipelineId}
        enhancePrompt={enhancePrompt}
        backendHealth={backendHealth}
        onTextModelChange={setTextModelId}
        onPromptProfileChange={setPromptProfileId}
        onImageProviderChange={setImageProviderId}
        onImagePipelineChange={setImagePipelineId}
        onEnhancePromptChange={setEnhancePrompt}
        onToggleImageMode={() => {
          setImageError(undefined)
          setIsImageMode((current) => !current)
        }}
      />
    </div>
  )
}
