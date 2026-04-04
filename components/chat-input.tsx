'use client'

import { useRef, useEffect } from 'react'
import { ArrowUp, ImagePlus, Loader2, MessageSquare } from 'lucide-react'
import { HubControls } from '@/components/hub-controls'
import type {
  ImagePipelineId,
  ImageProviderId,
  PromptProfileId,
  TextModelId,
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
  onTextModelChange,
  onPromptProfileChange,
  onImageProviderChange,
  onImagePipelineChange,
  onEnhancePromptChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const textareaId = isImageMode ? 'image-prompt-input' : 'chat-message-input'
  const helperTextId = isImageMode ? 'image-prompt-help' : 'chat-message-help'

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
            {isImageMode ? 'Saadan kirjelduse valitud pildipipeline' : 'Saadan prompti valitud tekstimudelile'}
          </p>
        </div>
        <div className="mb-3">
          <HubControls
            isImageMode={isImageMode}
            textModelId={textModelId}
            promptProfileId={promptProfileId}
            imageProviderId={imageProviderId}
            imagePipelineId={imagePipelineId}
            enhancePrompt={enhancePrompt}
            onTextModelChange={onTextModelChange}
            onPromptProfileChange={onPromptProfileChange}
            onImageProviderChange={onImageProviderChange}
            onImagePipelineChange={onImagePipelineChange}
            onEnhancePromptChange={onEnhancePromptChange}
          />
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
              ? 'Kirjuta siia pildi kirjeldus ja kasuta uleval backendi, pipeline\'i ning enhance lülitit.'
              : 'Valdo AI Hub - vali mudel ja prompti profiil vastavalt tööle'}
          </p>
        )}
      </div>
    </div>
  )
}
