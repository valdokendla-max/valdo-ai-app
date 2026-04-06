'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { UIMessage } from 'ai'
import { ChatHeader } from '@/components/chat-header'
import { ChatMessage } from '@/components/chat-message'
import { ChatInput } from '@/components/chat-input'
import { HubStatusBar } from '@/components/hub-status-bar'
import { ChatWelcome } from '@/components/chat-welcome'
import { KnowledgePanel } from '@/components/knowledge-panel'
import {
  DEFAULT_IMAGE_ASPECT_RATIO_ID,
  DEFAULT_IMAGE_PIPELINE_ID,
  DEFAULT_IMAGE_PROVIDER_ID,
  DEFAULT_IMAGE_SAFETY_MODE_ID,
  DEFAULT_PROMPT_PROFILE_ID,
  DEFAULT_IMAGE_STYLE_PRESET_ID,
  DEFAULT_TEXT_MODEL_ID,
  type ImageAspectRatioId,
  type ImagePipelineId,
  type ImageProviderId,
  type ImageSafetyModeId,
  type ImageStylePresetId,
  type PromptProfileId,
  type TextModelId,
} from '@/lib/ai-hub'
import {
  DEFAULT_CHAT_ARTIFACT_FORMAT,
  DEFAULT_CHAT_OUTPUT_MODE,
  type ChatArtifactFormatId,
  type ChatOutputModeId,
} from '@/lib/chat-output'
import {
  buildImageStatusText,
  createTextMessage,
  PUBLIC_HOST,
  PROTECTED_HOSTS,
  resolveClientApiPath,
  sanitizeMessagesForChatModel,
  serializeMessagesForStorage,
  type ChatStreamEvent,
  type ImageJobStatus,
} from '@/lib/chat-client'
import {
  CHAT_CONVERSATIONS_STORAGE_KEY,
  buildConversationTitle,
  createConversation,
  createDefaultConversationSettings,
  parseConversationState,
  type ConversationSettings,
  type StoredConversation,
} from '@/lib/chat-conversations'

type DisplayImageStage = 'idle' | 'starting' | 'queued' | 'running' | 'enhancing' | 'done' | 'failed'

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
  usedSeed?: number
  error?: string
}

type ConversationReferenceImage = {
  name: string
  dataUrl: string
}

type BackendHealthResponse = {
  automatic1111: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
  comfyui: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
  replicate: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
}
const HUB_SETTINGS_STORAGE_KEY = 'valdo-ai-hub-settings'
const CHAT_MESSAGES_STORAGE_KEY = 'valdo-ai-chat-messages'

function isNearBottom(element: HTMLDivElement, threshold = 72) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold
}

export default function ValdoAI() {
  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState('')
  const [isConversationStateReady, setIsConversationStateReady] = useState(false)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [referenceImagesByConversation, setReferenceImagesByConversation] = useState<
    Record<string, ConversationReferenceImage | undefined>
  >({})
  const [input, setInput] = useState('')
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [isImageMode, setIsImageMode] = useState(false)
  const [chatError, setChatError] = useState<string | undefined>()
  const [imageError, setImageError] = useState<string | undefined>()
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [isTextLoading, setIsTextLoading] = useState(false)
  const [textModelId, setTextModelId] = useState<TextModelId>(DEFAULT_TEXT_MODEL_ID)
  const [promptProfileId, setPromptProfileId] = useState<PromptProfileId>(
    DEFAULT_PROMPT_PROFILE_ID
  )
  const [outputMode, setOutputMode] = useState<ChatOutputModeId>(DEFAULT_CHAT_OUTPUT_MODE)
  const [artifactFormat, setArtifactFormat] = useState<ChatArtifactFormatId>(
    DEFAULT_CHAT_ARTIFACT_FORMAT
  )
  const [imageProviderId, setImageProviderId] = useState<ImageProviderId>(
    DEFAULT_IMAGE_PROVIDER_ID
  )
  const [imageAspectRatioId, setImageAspectRatioId] = useState<ImageAspectRatioId>(
    DEFAULT_IMAGE_ASPECT_RATIO_ID
  )
  const [imageStylePresetId, setImageStylePresetId] = useState<ImageStylePresetId>(
    DEFAULT_IMAGE_STYLE_PRESET_ID
  )
  const [imageSeed, setImageSeed] = useState<number | null>(null)
  const [imageVariationStrength, setImageVariationStrength] = useState(0)
  const [imageToImageStrength, setImageToImageStrength] = useState(45)
  const [imagePipelineId, setImagePipelineId] = useState<ImagePipelineId>(
    DEFAULT_IMAGE_PIPELINE_ID
  )
  const [imageAdultOnly, setImageAdultOnly] = useState(false)
  const [imageSafetyModeId, setImageSafetyModeId] = useState<ImageSafetyModeId>(
    DEFAULT_IMAGE_SAFETY_MODE_ID
  )
  const [enhancePrompt, setEnhancePrompt] = useState(true)
  const [imageStage, setImageStage] = useState<DisplayImageStage>('idle')
  const [backendHealth, setBackendHealth] = useState<BackendHealthResponse | null>(null)
  const [activeImageProviderId, setActiveImageProviderId] = useState<ImageProviderId | null>(null)
  const [isRedirectingHost, setIsRedirectingHost] = useState(false)
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollTopRef = useRef<number | null>(null)
  const shouldAutoScrollRef = useRef(true)
  const activeRequestControllerRef = useRef<AbortController | null>(null)
  const activeMessageIdRef = useRef<string | null>(null)
  const activeTaskTypeRef = useRef<'text' | 'image' | null>(null)

  const setActiveRequest = (controller: AbortController, messageId: string, type: 'text' | 'image') => {
    activeRequestControllerRef.current = controller
    activeMessageIdRef.current = messageId
    activeTaskTypeRef.current = type
  }

  const clearActiveRequest = () => {
    activeRequestControllerRef.current = null
    activeMessageIdRef.current = null
    activeTaskTypeRef.current = null
  }

  const applyConversation = (conversation: StoredConversation) => {
    setMessages(conversation.messages)
    setInput(conversation.draftInput)
    setIsImageMode(conversation.settings.isImageMode)
    setTextModelId(conversation.settings.textModelId)
    setPromptProfileId(conversation.settings.promptProfileId)
    setOutputMode(conversation.settings.outputMode)
    setArtifactFormat(conversation.settings.artifactFormat)
    setImageProviderId(conversation.settings.imageProviderId)
    setImageAspectRatioId(conversation.settings.imageAspectRatioId)
    setImageStylePresetId(conversation.settings.imageStylePresetId)
    setImageSeed(conversation.settings.imageSeed)
    setImageVariationStrength(conversation.settings.imageVariationStrength)
    setImageToImageStrength(conversation.settings.imageToImageStrength)
    setImagePipelineId(conversation.settings.imagePipelineId)
    setImageAdultOnly(conversation.settings.imageAdultOnly)
    setImageSafetyModeId(conversation.settings.imageSafetyModeId)
    setEnhancePrompt(conversation.settings.enhancePrompt)
    setChatError(undefined)
    setImageError(undefined)
    setIsImageLoading(false)
    setIsTextLoading(false)
    setImageStage('idle')
    setActiveImageProviderId(null)
    pendingScrollTopRef.current = conversation.scrollTop
  }

  const buildCurrentConversationSettings = useCallback((): ConversationSettings => ({
    isImageMode,
    textModelId,
    promptProfileId,
    outputMode,
    artifactFormat,
    imageProviderId,
    imageAspectRatioId,
    imageStylePresetId,
    imageSeed,
    imageVariationStrength,
    imageToImageStrength,
    imagePipelineId,
    imageAdultOnly,
    imageSafetyModeId,
    enhancePrompt,
  }), [
    artifactFormat,
    enhancePrompt,
    imageAdultOnly,
    imageAspectRatioId,
    imagePipelineId,
    imageProviderId,
    imageSafetyModeId,
    imageSeed,
    imageStylePresetId,
    imageToImageStrength,
    imageVariationStrength,
    isImageMode,
    outputMode,
    promptProfileId,
    textModelId,
  ])

  const currentReferenceImage =
    activeConversationId ? referenceImagesByConversation[activeConversationId] ?? null : null

  const updateActiveConversation = useCallback((updater: (conversation: StoredConversation) => StoredConversation) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversationId ? updater(conversation) : conversation
      )
    )
  }, [activeConversationId])

  const persistCurrentScrollPosition = () => {
    const currentScrollTop = scrollRef.current?.scrollTop ?? 0

    updateActiveConversation((conversation) => ({
      ...conversation,
      scrollTop: currentScrollTop,
    }))
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const currentHost = window.location.host

    if (!PROTECTED_HOSTS.has(currentHost)) {
      setApiBaseUrl('')
      return
    }

    setApiBaseUrl(`https://${PUBLIC_HOST}`)
    setIsRedirectingHost(true)

    const redirectUrl = new URL(window.location.href)
    redirectUrl.host = PUBLIC_HOST
    redirectUrl.protocol = 'https:'

    window.location.replace(redirectUrl.toString())
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadHealth = async () => {
      try {
        const response = await fetch(resolveClientApiPath('/api/backends/health'), {
          cache: 'no-store',
        })
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
    if (!backendHealth) {
      return
    }

    const comfyConnected = backendHealth.comfyui.status === 'connected'
    const automaticConnected = backendHealth.automatic1111.status === 'connected'
    const replicateAvailable = backendHealth.replicate.status !== 'missing'
    const hasConnectedLocalBackend = comfyConnected || automaticConnected

    if (imageProviderId === 'replicate' && !replicateAvailable) {
      setImageProviderId('auto')
      return
    }

    if (imageProviderId === 'comfyui' && !comfyConnected && replicateAvailable) {
      setImageProviderId('replicate')
      return
    }

    if (imageProviderId === 'automatic1111' && !automaticConnected && replicateAvailable) {
      setImageProviderId('replicate')
      return
    }

    if (imageProviderId === 'auto' && !hasConnectedLocalBackend && replicateAvailable) {
      setImageProviderId('replicate')
    }
  }, [backendHealth, imageProviderId])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const storedState = parseConversationState(
      window.localStorage.getItem(CHAT_CONVERSATIONS_STORAGE_KEY)
    )

    let nextConversations = storedState.conversations
    let nextActiveConversationId = storedState.activeConversationId

    if (nextConversations.length === 0) {
      const defaultSettings = createDefaultConversationSettings()
      const legacyMessagesRaw = window.localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY)
      const legacySettingsRaw = window.localStorage.getItem(HUB_SETTINGS_STORAGE_KEY)
      let migratedSettings = defaultSettings

      if (legacySettingsRaw) {
        try {
          const parsed = JSON.parse(legacySettingsRaw) as Partial<ConversationSettings>
          migratedSettings = {
            ...defaultSettings,
            ...parsed,
          }
        } catch {
          window.localStorage.removeItem(HUB_SETTINGS_STORAGE_KEY)
        }
      }

      const migratedMessages = legacyMessagesRaw
        ? parseConversationState(
            JSON.stringify({
              activeConversationId: 'legacy',
              conversations: [
                {
                  id: 'legacy',
                  messages: JSON.parse(legacyMessagesRaw),
                  settings: migratedSettings,
                },
              ],
            })
          ).conversations[0]?.messages ?? []
        : []

      const migratedConversation = createConversation(migratedSettings, {
        messages: migratedMessages,
      })

      nextConversations = [migratedConversation]
      nextActiveConversationId = migratedConversation.id
    }

    const activeConversation =
      nextConversations.find((conversation) => conversation.id === nextActiveConversationId) ??
      nextConversations[0]

    setConversations(nextConversations)
    setActiveConversationId(activeConversation.id)
    applyConversation(activeConversation)
    setIsConversationStateReady(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !isConversationStateReady || !activeConversationId) {
      return
    }

    window.localStorage.setItem(
      CHAT_CONVERSATIONS_STORAGE_KEY,
      JSON.stringify({
        activeConversationId,
        conversations: conversations.map((conversation) => ({
          ...conversation,
          messages: serializeMessagesForStorage(conversation.messages),
        })),
      })
    )
    window.localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY)
    window.localStorage.removeItem(HUB_SETTINGS_STORAGE_KEY)
  }, [activeConversationId, conversations, isConversationStateReady])

  useEffect(() => {
    if (!isConversationStateReady || !activeConversationId) {
      return
    }

    updateActiveConversation((conversation) => ({
      ...conversation,
      title: buildConversationTitle(messages),
      messages,
      draftInput: input,
      settings: buildCurrentConversationSettings(),
      updatedAt: new Date().toISOString(),
    }))
  }, [
    activeConversationId,
    enhancePrompt,
    artifactFormat,
    buildCurrentConversationSettings,
    imageAdultOnly,
    imageAspectRatioId,
    imagePipelineId,
    imageProviderId,
    imageSafetyModeId,
    imageSeed,
    imageStylePresetId,
    imageToImageStrength,
    imageVariationStrength,
    input,
    isConversationStateReady,
    isImageMode,
    messages,
    outputMode,
    promptProfileId,
    textModelId,
    updateActiveConversation,
  ])

  const isLoading = isTextLoading
  const isBusy = isLoading || isImageLoading
  const canCancel =
    isBusy || imageStage === 'starting' || imageStage === 'queued' || imageStage === 'running' || imageStage === 'enhancing'
  const displayError = imageError || chatError

  useEffect(() => {
    if (!scrollRef.current) {
      return
    }

    if (pendingScrollTopRef.current !== null) {
      const targetScrollTop = pendingScrollTopRef.current
      pendingScrollTopRef.current = null
      window.requestAnimationFrame(() => {
        if (!scrollRef.current) {
          return
        }

        scrollRef.current.scrollTop = targetScrollTop
        shouldAutoScrollRef.current = isNearBottom(scrollRef.current)
      })
      return
    }

    if (shouldAutoScrollRef.current || isNearBottom(scrollRef.current)) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activeConversationId, isImageLoading, isTextLoading, messages])

  const handleTextSubmit = () => {
    void submitTextPrompt(input)
  }

  const appendSystemSuffixToMessage = (messageId: string, suffix: string) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) {
          return message
        }

        const currentText = message.parts
          ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
          .map((part) => part.text)
          .join('') || ''

        const nextText = currentText.trim() ? `${currentText}\n\n${suffix}` : suffix

        return {
          ...message,
          parts: [{ type: 'text', text: nextText }],
        }
      })
    )
  }

  const stopActiveTask = () => {
    const activeController = activeRequestControllerRef.current
    const activeMessageId = activeMessageIdRef.current

    activeController?.abort()

    if (activeMessageId) {
      appendSystemSuffixToMessage(activeMessageId, 'Tegevus peatati kasutaja poolt.')
    }

    setChatError(undefined)
    setImageError(undefined)
    setIsTextLoading(false)
    setIsImageLoading(false)
    setImageStage('idle')
    setActiveImageProviderId(null)
    clearActiveRequest()
  }

  const appendMessageText = (messageId: string, chunk: string) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) {
          return message
        }

        const currentText = message.parts
          ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
          .map((part) => part.text)
          .join('') || ''

        return {
          ...message,
          parts: [{ type: 'text', text: `${currentText}${chunk}` }],
        }
      })
    )
  }

  const consumeChatStream = async (
    response: Response,
    assistantMessageId: string,
    signal: AbortSignal
  ) => {
    const reader = response.body?.getReader()

    if (!reader) {
      throw new Error('Chat stream puudub.')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let sawTextDelta = false

    while (true) {
      if (signal.aborted) {
        throw new DOMException('Chat stream peatati.', 'AbortError')
      }

      const { done, value } = await reader.read()

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      while (true) {
        const eventBoundary = buffer.indexOf('\n\n')

        if (eventBoundary === -1) {
          break
        }

        const rawEvent = buffer.slice(0, eventBoundary)
        buffer = buffer.slice(eventBoundary + 2)

        const dataPayload = rawEvent
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')

        if (!dataPayload || dataPayload === '[DONE]') {
          continue
        }

        const event = JSON.parse(dataPayload) as ChatStreamEvent

        if (event.type === 'text-delta' && typeof event.delta === 'string') {
          sawTextDelta = true
          appendMessageText(assistantMessageId, event.delta)
        }
      }
    }

    if (!sawTextDelta) {
      replaceMessageText(assistantMessageId, 'Vastus saabus tühjana. Proovi uuesti.')
    }
  }

  const submitTextPrompt = async (rawInput: string) => {
    const prompt = rawInput.trim()

    if (!prompt || isBusy) {
      return
    }

    const userMessage = createTextMessage('user', prompt)
    const assistantPlaceholder = createTextMessage('assistant', '')

    setChatError(undefined)
    setImageError(undefined)
    setIsTextLoading(true)
    setInput('')
    shouldAutoScrollRef.current = true
    setMessages((current) => [...current, userMessage, assistantPlaceholder])
    const controller = new AbortController()
    setActiveRequest(controller, assistantPlaceholder.id, 'text')

    try {
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: sanitizeMessagesForChatModel([...messages, userMessage]),
          modelId: textModelId,
          promptProfileId,
          outputMode,
          artifactFormat,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Tekstivastus ebaõnnestus.')
      }

      await consumeChatStream(response, assistantPlaceholder.id, controller.signal)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      const message = error instanceof Error ? error.message : 'Tekstivastus ebaõnnestus.'
      setChatError(message)
      replaceMessageText(assistantPlaceholder.id, `Vastamine ebaõnnestus: ${message}`)
    } finally {
      setIsTextLoading(false)
      if (activeMessageIdRef.current === assistantPlaceholder.id) {
        clearActiveRequest()
      }
    }
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
    pipelineId: ImagePipelineId,
    usedSeed?: number,
    signal?: AbortSignal
  ) => {
    let finalImageDataUrl = imageDataUrl

    if (shouldUpscale) {
      setImageStage('enhancing')
      replaceMessageText(placeholderId, `Täiustan loodud pilti: **${prompt}**`)

      const response = await fetch(resolveClientApiPath('/api/image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upscale',
          imageDataUrl,
          pipelineId,
        }),
        signal,
      })

      const data = await response.json()

      if (!response.ok || !data.imageDataUrl) {
        throw new Error(data.error || 'Pildi täiustamine ebaõnnestus.')
      }

      finalImageDataUrl = data.imageDataUrl
    }

    const assistantMessage = createTextMessage(
      'assistant',
      `Loodud pilt promptist: **${prompt}**${usedSeed === undefined ? '' : `\n\nSeed: **${usedSeed}** · Stiil: **${imageStylePresetId}** · Variatsioon: **${imageVariationStrength}%**${currentReferenceImage ? ` · Viitepilt: **${currentReferenceImage.name}** · Tugevus: **${imageToImageStrength}%**` : ''}`}\n\n![Loodud pilt](${finalImageDataUrl})`
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
    pipelineId: ImagePipelineId,
    usedSeed?: number,
    signal?: AbortSignal
  ) => {
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        }, ms)

        const onAbort = () => {
          window.clearTimeout(timer)
          signal?.removeEventListener('abort', onAbort)
          reject(new DOMException('Pilditöö peatati.', 'AbortError'))
        }

        if (signal?.aborted) {
          onAbort()
          return
        }

        signal?.addEventListener('abort', onAbort)
      })

    for (let attempt = 0; attempt < 90; attempt++) {
      await wait(4000)

      const params = new URLSearchParams({ promptId })

      const response = await fetch(`${resolveClientApiPath('/api/image')}?${params.toString()}`, {
        cache: 'no-store',
        signal,
      })

      const data = (await response.json()) as ImageStatusResponse

      if (!response.ok) {
        throw new Error(data.error || 'Pildi oleku kontroll ebaõnnestus.')
      }

      if (data.status === 'succeeded' && data.imageDataUrl) {
        await finalizeImageResult(
          prompt,
          placeholderId,
          data.imageDataUrl,
          shouldUpscale,
          pipelineId,
          usedSeed,
          signal
        )
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
    const activeStylePresetId = imageStylePresetId
    const activeSeed = imageSeed
    const activeVariationStrength = imageVariationStrength
    const activeImageToImageStrength = imageToImageStrength
    const activeImageAdultOnly = imageAdultOnly
    const activeImageSafetyModeId = imageSafetyModeId
    const activeReferenceImage = currentReferenceImage

    if (!prompt || isBusy) return

    const userMessage = createTextMessage('user', prompt)
    const placeholderMessage = createTextMessage(
      'assistant',
      buildImageStatusText(prompt, 'starting')
    )

    setImageError(undefined)
    setIsImageLoading(true)
    setImageStage('starting')
    setActiveImageProviderId(imageProviderId === 'auto' ? null : imageProviderId)
    setInput('')
    shouldAutoScrollRef.current = true
    setMessages((current) => [...current, userMessage, placeholderMessage])
    const controller = new AbortController()
    setActiveRequest(controller, placeholderMessage.id, 'image')

    try {
      const response = await fetch(resolveClientApiPath('/api/image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          providerId: imageProviderId,
          aspectRatioId: imageAspectRatioId,
          stylePresetId: activeStylePresetId,
          seed: activeSeed,
          variationStrength: activeVariationStrength,
          referenceImageDataUrl: activeReferenceImage?.dataUrl,
          imageToImageStrength: activeImageToImageStrength,
          pipelineId: activePipelineId,
          adultOnly: activeImageAdultOnly,
          safetyModeId: activeImageSafetyModeId,
          enhancePrompt: activeEnhancePrompt,
        }),
        signal: controller.signal,
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
          activePipelineId,
          data.usedSeed,
          controller.signal
        )
        return
      }

      if (!data.promptId) {
        throw new Error('Pilditöö ei tagastanud töö ID-d.')
      }

      setImageStage('queued')
      replaceMessageText(placeholderMessage.id, buildImageStatusText(prompt, 'queued'))

      await pollImageJob(
        data.promptId,
        placeholderMessage.id,
        prompt,
        Boolean(data.shouldUpscale ?? activeEnhancePrompt),
        activePipelineId,
        data.usedSeed,
        controller.signal
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

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
      if (activeMessageIdRef.current === placeholderMessage.id) {
        clearActiveRequest()
      }
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

    setChatError(undefined)
    setImageError(undefined)
    void submitTextPrompt(text)
  }

  const handleSelectConversation = (conversationId: string) => {
    if (conversationId === activeConversationId) {
      return
    }

    persistCurrentScrollPosition()

    const nextConversation = conversations.find((conversation) => conversation.id === conversationId)

    if (!nextConversation) {
      return
    }

    setActiveConversationId(nextConversation.id)
    applyConversation(nextConversation)
  }

  const handleNewConversation = () => {
    persistCurrentScrollPosition()

    const newConversation = createConversation(buildCurrentConversationSettings(), {
      draftInput: '',
      messages: [],
      scrollTop: 0,
    })

    setConversations((current) => [newConversation, ...current])
    setActiveConversationId(newConversation.id)
    applyConversation(newConversation)
    shouldAutoScrollRef.current = true
  }

  const handleConversationScroll = () => {
    if (!scrollRef.current) {
      return
    }

    shouldAutoScrollRef.current = isNearBottom(scrollRef.current)

    if (!isConversationStateReady || !activeConversationId) {
      return
    }

    const currentScrollTop = scrollRef.current.scrollTop

    updateActiveConversation((conversation) => ({
      ...conversation,
      scrollTop: currentScrollTop,
    }))
  }

  const handleReferenceImageChange = (dataUrl: string, name: string) => {
    if (!activeConversationId) {
      return
    }

    setReferenceImagesByConversation((current) => ({
      ...current,
      [activeConversationId]: { dataUrl, name },
    }))
  }

  const handleReferenceImageRemove = () => {
    if (!activeConversationId) {
      return
    }

    setReferenceImagesByConversation((current) => ({
      ...current,
      [activeConversationId]: undefined,
    }))
  }

  if (isRedirectingHost) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-6 text-center">
        <div className="rounded-2xl border border-border/60 bg-card/30 px-6 py-5 text-sm text-muted-foreground">
          Suunan sind avalikule domeenile, et vestlus töötaks samas lehes korrektselt...
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <ChatHeader
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onOpenKnowledge={() => setKnowledgeOpen(true)}
      />
      <HubStatusBar
        isImageMode={isImageMode}
        outputMode={outputMode}
        artifactFormat={artifactFormat}
        textModelId={textModelId}
        promptProfileId={promptProfileId}
        imageProviderId={imageProviderId}
        imageAspectRatioId={imageAspectRatioId}
        imageStylePresetId={imageStylePresetId}
        imageSeed={imageSeed}
        imageVariationStrength={imageVariationStrength}
        activeImageProviderId={activeImageProviderId}
        imagePipelineId={imagePipelineId}
        imageAdultOnly={imageAdultOnly}
        imageSafetyModeId={imageSafetyModeId}
        enhancePrompt={enhancePrompt}
        imageStage={imageStage}
        backendHealth={backendHealth}
      />
      <KnowledgePanel isOpen={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} />

      <div ref={scrollRef} onScroll={handleConversationScroll} className="flex-1 overflow-y-auto">
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
        onCancel={stopActiveTask}
        canCancel={canCancel}
        isLoading={isBusy}
        error={displayError}
        isImageMode={isImageMode}
        outputMode={outputMode}
        artifactFormat={artifactFormat}
        textModelId={textModelId}
        promptProfileId={promptProfileId}
        imageProviderId={imageProviderId}
        imageAspectRatioId={imageAspectRatioId}
        imageStylePresetId={imageStylePresetId}
        imageSeed={imageSeed}
        imageVariationStrength={imageVariationStrength}
        imageToImageStrength={imageToImageStrength}
        referenceImage={currentReferenceImage}
        imagePipelineId={imagePipelineId}
        imageAdultOnly={imageAdultOnly}
        imageSafetyModeId={imageSafetyModeId}
        enhancePrompt={enhancePrompt}
        backendHealth={backendHealth}
        onTextModelChange={setTextModelId}
        onPromptProfileChange={setPromptProfileId}
        onImageProviderChange={setImageProviderId}
        onImageAspectRatioChange={setImageAspectRatioId}
        onImageStylePresetChange={setImageStylePresetId}
        onImageSeedChange={setImageSeed}
        onImageVariationStrengthChange={setImageVariationStrength}
        onImageToImageStrengthChange={setImageToImageStrength}
        onReferenceImageChange={handleReferenceImageChange}
        onReferenceImageRemove={handleReferenceImageRemove}
        onImagePipelineChange={setImagePipelineId}
        onImageAdultOnlyChange={setImageAdultOnly}
        onImageSafetyModeChange={setImageSafetyModeId}
        onEnhancePromptChange={setEnhancePrompt}
        onOutputModeChange={setOutputMode}
        onArtifactFormatChange={setArtifactFormat}
        onToggleImageMode={() => {
          setImageError(undefined)
          setIsImageMode((current) => !current)
        }}
      />
    </div>
  )
}
