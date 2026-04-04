'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, ImagePlus, Loader2, MessageSquare } from 'lucide-react'
import { HubControls } from '@/components/hub-controls'
import type {
  ImagePipelineId,
  ImageProviderId,
  PromptProfileId,
  TextModelId,
} from '@/lib/ai-hub'
import {
  IMAGE_PIPELINES,
  IMAGE_PROVIDERS,
  PROMPT_PROFILES,
  TEXT_MODELS,
} from '@/lib/ai-hub'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  onSubmit: () => void
  isLoading: boolean
  error?: string
  isImageMode: boolean
  onToggleImageMode: () => void
  textModelId: TextModelId
  promptProfileId: PromptProfileId
  imageProviderId: ImageProviderId
  imagePipelineId: ImagePipelineId
  enhancePrompt: boolean
  backendHealth?: {
    automatic1111: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
    comfyui: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
    replicate: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
  } | null
  onTextModelChange: (value: TextModelId) => void
  onPromptProfileChange: (value: PromptProfileId) => void
  onImageProviderChange: (value: ImageProviderId) => void
  onImagePipelineChange: (value: ImagePipelineId) => void
  onEnhancePromptChange: (value: boolean) => void
}

export function ChatInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  error,
  isImageMode,
  onToggleImageMode,
  textModelId,
  promptProfileId,
  imageProviderId,
  imagePipelineId,
  enhancePrompt,
  backendHealth,
  onTextModelChange,
  onPromptProfileChange,
  onImageProviderChange,
  onImagePipelineChange,
  onEnhancePromptChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [controlsOpen, setControlsOpen] = useState(false)
  const textareaId = isImageMode ? 'image-prompt-input' : 'chat-message-input'
  const helperTextId = isImageMode ? 'image-prompt-help' : 'chat-message-help'

  const controlsSummary = useMemo(() => {
    if (isImageMode) {
      const providerLabel =
        IMAGE_PROVIDERS.find((provider) => provider.id === imageProviderId)?.label || imageProviderId
      const pipelineLabel =
        IMAGE_PIPELINES.find((pipeline) => pipeline.id === imagePipelineId)?.label || imagePipelineId

      return `${providerLabel} · ${pipelineLabel} · ${enhancePrompt ? '3 sammu' : '1 samm'}`
    }

    const modelLabel = TEXT_MODELS.find((model) => model.id === textModelId)?.label || textModelId
    const profileLabel =
      PROMPT_PROFILES.find((profile) => profile.id === promptProfileId)?.label || promptProfileId

    return `${modelLabel} · ${profileLabel}`
  }, [enhancePrompt, imagePipelineId, imageProviderId, isImageMode, promptProfileId, textModelId])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return
    onSubmit()
  }

  return (
    <div className="border-t border-border bg-background px-4 py-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            onClick={onToggleImageMode}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors',
              isImageMode
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
            )}
            type="button"
          >
            {isImageMode ? <MessageSquare className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {isImageMode ? 'Tekstireziim' : 'Loo pilt'}
          </button>
          <p className="text-xs text-muted-foreground">
            {isImageMode ? 'Saadan kirjelduse valitud pilditöövoole' : 'Saadan prompti valitud tekstimudelile'}
          </p>
        </div>
        <div className="mb-2 rounded-xl border border-border/60 bg-card/20 px-3 py-2">
          <button
            type="button"
            onClick={() => setControlsOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Seaded</p>
              <p className="mt-0.5 text-xs text-foreground">{controlsSummary}</p>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {controlsOpen ? 'Peida' : 'Muuda'}
            </span>
          </button>

          {controlsOpen ? (
            <div className="mt-2">
              <HubControls
                isImageMode={isImageMode}
                textModelId={textModelId}
                promptProfileId={promptProfileId}
                imageProviderId={imageProviderId}
                imagePipelineId={imagePipelineId}
                enhancePrompt={enhancePrompt}
                backendHealth={backendHealth}
                onTextModelChange={onTextModelChange}
                onPromptProfileChange={onPromptProfileChange}
                onImageProviderChange={onImageProviderChange}
                onImagePipelineChange={onImagePipelineChange}
                onEnhancePromptChange={onEnhancePromptChange}
              />
            </div>
          ) : null}
        </div>
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <textarea
            ref={textareaRef}
            id={textareaId}
            name={textareaId}
            aria-describedby={helperTextId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={isImageMode ? 'Kirjelda pilti, mida soovid luua...' : 'Kirjuta siia...'}
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
              input.trim() && !isLoading
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'bg-secondary text-muted-foreground'
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-center text-xs text-red-400">
            {error}
          </p>
        ) : (
          <p id={helperTextId} className="mt-2 text-center text-xs text-muted-foreground">
            {isImageMode
              ? 'Parim tulemus: subjekt + tegevus + koht + valgus + stiil. Naide: noor naine punases kleidis uduses metsas kuuvalguses, cinematic, realistic.'
              : 'Valdo AI Hub - vali mudel ja prompti profiil vastavalt tööle'}
          </p>
        )}
      </div>
    </div>
  )
}
