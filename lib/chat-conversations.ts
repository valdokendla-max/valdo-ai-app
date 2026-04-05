import type { UIMessage } from 'ai'
import {
  DEFAULT_IMAGE_ASPECT_RATIO_ID,
  DEFAULT_IMAGE_PIPELINE_ID,
  DEFAULT_IMAGE_PROVIDER_ID,
  DEFAULT_PROMPT_PROFILE_ID,
  DEFAULT_IMAGE_STYLE_PRESET_ID,
  DEFAULT_TEXT_MODEL_ID,
  type ImageAspectRatioId,
  type ImagePipelineId,
  type ImageProviderId,
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
import { parseStoredMessages } from '@/lib/chat-client'

export const CHAT_CONVERSATIONS_STORAGE_KEY = 'valdo-ai-chat-conversations-v2'
export const DEFAULT_CONVERSATION_TITLE = 'Uus vestlus'

export type ConversationSettings = {
  isImageMode: boolean
  textModelId: TextModelId
  promptProfileId: PromptProfileId
  outputMode: ChatOutputModeId
  artifactFormat: ChatArtifactFormatId
  imageProviderId: ImageProviderId
  imageAspectRatioId: ImageAspectRatioId
  imageStylePresetId: ImageStylePresetId
  imageSeed: number | null
  imageVariationStrength: number
  imageToImageStrength: number
  imagePipelineId: ImagePipelineId
  enhancePrompt: boolean
}

export type StoredConversation = {
  id: string
  title: string
  messages: UIMessage[]
  draftInput: string
  scrollTop: number
  createdAt: string
  updatedAt: string
  settings: ConversationSettings
}

export type StoredConversationState = {
  activeConversationId: string
  conversations: StoredConversation[]
}

export function createDefaultConversationSettings(): ConversationSettings {
  return {
    isImageMode: false,
    textModelId: DEFAULT_TEXT_MODEL_ID,
    promptProfileId: DEFAULT_PROMPT_PROFILE_ID,
    outputMode: DEFAULT_CHAT_OUTPUT_MODE,
    artifactFormat: DEFAULT_CHAT_ARTIFACT_FORMAT,
    imageProviderId: DEFAULT_IMAGE_PROVIDER_ID,
    imageAspectRatioId: DEFAULT_IMAGE_ASPECT_RATIO_ID,
    imageStylePresetId: DEFAULT_IMAGE_STYLE_PRESET_ID,
    imageSeed: null,
    imageVariationStrength: 0,
    imageToImageStrength: 45,
    imagePipelineId: DEFAULT_IMAGE_PIPELINE_ID,
    enhancePrompt: true,
  }
}

function normalizeConversationSettings(rawValue: unknown): ConversationSettings {
  const defaults = createDefaultConversationSettings()

  if (!rawValue || typeof rawValue !== 'object') {
    return defaults
  }

  const raw = rawValue as Partial<ConversationSettings>

  return {
    isImageMode: typeof raw.isImageMode === 'boolean' ? raw.isImageMode : defaults.isImageMode,
    textModelId: raw.textModelId ?? defaults.textModelId,
    promptProfileId: raw.promptProfileId ?? defaults.promptProfileId,
    outputMode: raw.outputMode ?? defaults.outputMode,
    artifactFormat: raw.artifactFormat ?? defaults.artifactFormat,
    imageProviderId: raw.imageProviderId ?? defaults.imageProviderId,
    imageAspectRatioId: raw.imageAspectRatioId ?? defaults.imageAspectRatioId,
    imageStylePresetId: raw.imageStylePresetId ?? defaults.imageStylePresetId,
    imageSeed: typeof raw.imageSeed === 'number' ? raw.imageSeed : defaults.imageSeed,
    imageVariationStrength:
      typeof raw.imageVariationStrength === 'number'
        ? Math.max(0, Math.min(100, raw.imageVariationStrength))
        : defaults.imageVariationStrength,
    imageToImageStrength:
      typeof raw.imageToImageStrength === 'number'
        ? Math.max(0, Math.min(100, raw.imageToImageStrength))
        : defaults.imageToImageStrength,
    imagePipelineId: raw.imagePipelineId ?? defaults.imagePipelineId,
    enhancePrompt:
      typeof raw.enhancePrompt === 'boolean' ? raw.enhancePrompt : defaults.enhancePrompt,
  }
}

function getMessageText(message: UIMessage) {
  return message.parts
    ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .trim()
}

export function buildConversationTitle(messages: UIMessage[]) {
  const firstUserText = messages.find((message) => message.role === 'user')
  const rawTitle = firstUserText ? getMessageText(firstUserText) : ''

  if (!rawTitle) {
    return DEFAULT_CONVERSATION_TITLE
  }

  const compactTitle = rawTitle.replace(/\s+/g, ' ').trim()
  return compactTitle.length > 48 ? `${compactTitle.slice(0, 47).trimEnd()}…` : compactTitle
}

export function createConversation(
  settings: ConversationSettings,
  overrides?: Partial<StoredConversation>
): StoredConversation {
  const now = new Date().toISOString()
  const messages = overrides?.messages ?? []

  return {
    id: overrides?.id ?? crypto.randomUUID(),
    title: overrides?.title ?? buildConversationTitle(messages),
    messages,
    draftInput: overrides?.draftInput ?? '',
    scrollTop: overrides?.scrollTop ?? 0,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    settings: overrides?.settings ?? settings,
  }
}

export function parseConversationState(rawValue: string | null): StoredConversationState {
  if (!rawValue) {
    return { activeConversationId: '', conversations: [] }
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<StoredConversationState>

    if (!Array.isArray(parsed.conversations)) {
      return { activeConversationId: '', conversations: [] }
    }

    const conversations = parsed.conversations.flatMap((conversation) => {
      if (!conversation || typeof conversation !== 'object' || typeof conversation.id !== 'string') {
        return []
      }

      const validatedMessages = parseStoredMessages(JSON.stringify((conversation as StoredConversation).messages ?? []))
      const validatedSettings = normalizeConversationSettings(
        (conversation as StoredConversation).settings
      )

      return [
        {
          id: conversation.id,
          title:
            typeof (conversation as StoredConversation).title === 'string' &&
            (conversation as StoredConversation).title.trim()
              ? (conversation as StoredConversation).title.trim()
              : buildConversationTitle(validatedMessages),
          messages: validatedMessages,
          draftInput:
            typeof (conversation as StoredConversation).draftInput === 'string'
              ? (conversation as StoredConversation).draftInput
              : '',
          scrollTop:
            typeof (conversation as StoredConversation).scrollTop === 'number'
              ? (conversation as StoredConversation).scrollTop
              : 0,
          createdAt:
            typeof (conversation as StoredConversation).createdAt === 'string'
              ? (conversation as StoredConversation).createdAt
              : new Date().toISOString(),
          updatedAt:
            typeof (conversation as StoredConversation).updatedAt === 'string'
              ? (conversation as StoredConversation).updatedAt
              : new Date().toISOString(),
          settings: validatedSettings,
        } satisfies StoredConversation,
      ]
    })

    const activeConversationId =
      typeof parsed.activeConversationId === 'string' ? parsed.activeConversationId : ''

    return {
      activeConversationId,
      conversations,
    }
  } catch {
    return { activeConversationId: '', conversations: [] }
  }
}