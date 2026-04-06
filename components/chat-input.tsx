'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, ImagePlus, Loader2, MessageSquare, Upload, X } from 'lucide-react'
import { HubControls } from '@/components/hub-controls'
import {
  CHAT_ARTIFACT_FORMATS,
  CHAT_OUTPUT_MODES,
  type ChatArtifactFormatId,
  type ChatOutputModeId,
} from '@/lib/chat-output'
import type {
  ImageAspectRatioId,
  ImagePipelineId,
  ImageProviderId,
  ImageStylePresetId,
  PromptProfileId,
  TextModelId,
} from '@/lib/ai-hub'
import {
  IMAGE_ASPECT_RATIOS,
  IMAGE_PIPELINES,
  IMAGE_PROVIDERS,
  IMAGE_STYLE_PRESETS,
  PROMPT_PROFILES,
  TEXT_MODELS,
} from '@/lib/ai-hub'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  canCancel: boolean
  isLoading: boolean
  error?: string
  isImageMode: boolean
  onToggleImageMode: () => void
  outputMode: ChatOutputModeId
  artifactFormat: ChatArtifactFormatId
  textModelId: TextModelId
  promptProfileId: PromptProfileId
  imageProviderId: ImageProviderId
  imageAspectRatioId: ImageAspectRatioId
  imageStylePresetId: ImageStylePresetId
  imageSeed: number | null
  imageVariationStrength: number
  imageToImageStrength: number
  referenceImage?: {
    name: string
    dataUrl: string
  } | null
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
  onImageAspectRatioChange: (value: ImageAspectRatioId) => void
  onImageStylePresetChange: (value: ImageStylePresetId) => void
  onImageSeedChange: (value: number | null) => void
  onImageVariationStrengthChange: (value: number) => void
  onImageToImageStrengthChange: (value: number) => void
  onReferenceImageChange: (dataUrl: string, name: string) => void
  onReferenceImageRemove: () => void
  onImagePipelineChange: (value: ImagePipelineId) => void
  onEnhancePromptChange: (value: boolean) => void
  onOutputModeChange: (value: ChatOutputModeId) => void
  onArtifactFormatChange: (value: ChatArtifactFormatId) => void
}

export function ChatInput({
  input,
  setInput,
  onSubmit,
  onCancel,
  canCancel,
  isLoading,
  error,
  isImageMode,
  onToggleImageMode,
  outputMode,
  artifactFormat,
  textModelId,
  promptProfileId,
  imageProviderId,
  imageAspectRatioId,
  imageStylePresetId,
  imageSeed,
  imageVariationStrength,
  imageToImageStrength,
  referenceImage,
  imagePipelineId,
  enhancePrompt,
  backendHealth,
  onTextModelChange,
  onPromptProfileChange,
  onImageProviderChange,
  onImageAspectRatioChange,
  onImageStylePresetChange,
  onImageSeedChange,
  onImageVariationStrengthChange,
  onImageToImageStrengthChange,
  onReferenceImageChange,
  onReferenceImageRemove,
  onImagePipelineChange,
  onEnhancePromptChange,
  onOutputModeChange,
  onArtifactFormatChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const shouldOpenReferencePickerRef = useRef(false)
  const [controlsOpen, setControlsOpen] = useState(false)
  const textareaId = isImageMode ? 'image-prompt-input' : 'chat-message-input'
  const helperTextId = isImageMode ? 'image-prompt-help' : 'chat-message-help'

  const controlsSummary = useMemo(() => {
    if (isImageMode) {
      const providerLabel =
        IMAGE_PROVIDERS.find((provider) => provider.id === imageProviderId)?.label || imageProviderId
      const aspectRatioLabel =
        IMAGE_ASPECT_RATIOS.find((aspectRatio) => aspectRatio.id === imageAspectRatioId)?.label ||
        imageAspectRatioId
      const stylePresetLabel =
        IMAGE_STYLE_PRESETS.find((preset) => preset.id === imageStylePresetId)?.label ||
        imageStylePresetId
      const pipelineLabel =
        IMAGE_PIPELINES.find((pipeline) => pipeline.id === imagePipelineId)?.label || imagePipelineId
      const seedLabel = imageSeed === null ? 'seed auto' : `seed ${imageSeed}`
      const referenceLabel = referenceImage ? `ref ${imageToImageStrength}%` : 'ilma refita'

      return `${providerLabel} | ${aspectRatioLabel} | ${stylePresetLabel} | ${pipelineLabel} | ${seedLabel} | var ${imageVariationStrength}% | ${referenceLabel} | ${enhancePrompt ? '3 sammu' : '1 samm'}`
    }

    const modelLabel = TEXT_MODELS.find((model) => model.id === textModelId)?.label || textModelId
    const profileLabel =
      PROMPT_PROFILES.find((profile) => profile.id === promptProfileId)?.label || promptProfileId
    const outputModeLabel =
      CHAT_OUTPUT_MODES.find((mode) => mode.id === outputMode)?.label || outputMode
    const formatLabel =
      CHAT_ARTIFACT_FORMATS.find((format) => format.id === artifactFormat)?.label || artifactFormat

    return outputMode === 'chat'
      ? `${modelLabel} | ${profileLabel} | ${outputModeLabel}`
      : `${modelLabel} | ${profileLabel} | ${outputModeLabel} | ${formatLabel}`
  }, [
    artifactFormat,
    enhancePrompt,
    imageAspectRatioId,
    imagePipelineId,
    imageProviderId,
    imageSeed,
    imageStylePresetId,
    imageToImageStrength,
    imageVariationStrength,
    isImageMode,
    outputMode,
    promptProfileId,
    referenceImage,
    textModelId,
  ])

  const handleReferenceImageSelection = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Viitepildi lugemine ebaõnnestus.'))
      reader.readAsDataURL(file)
    })

    onReferenceImageChange(dataUrl, file.name)
    event.target.value = ''
  }

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  useEffect(() => {
    if (!isImageMode || !shouldOpenReferencePickerRef.current) {
      return
    }

    shouldOpenReferencePickerRef.current = false
    fileInputRef.current?.click()
  }, [isImageMode])

  const handleReferencePickerOpen = () => {
    if (!isImageMode) {
      shouldOpenReferencePickerRef.current = true
      onToggleImageMode()
      return
    }

    fileInputRef.current?.click()
  }

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return
    onSubmit()
  }

  return (
    <div className="border-t border-border bg-background px-4 py-4">
      <div className="mx-auto max-w-3xl">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => void handleReferenceImageSelection(event)}
        />
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              onClick={handleReferencePickerOpen}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                isImageMode
                  ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
                  : 'border-border/70 bg-card text-foreground hover:bg-secondary'
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              {referenceImage ? 'Vaheta viitepilti' : 'Lisa viitepilt'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {isImageMode
              ? 'Saadan kirjelduse valitud pilditöövoole'
              : 'Viitepildi nupp avab pildireziimi ja failivalija kohe'}
          </p>
        </div>
        {!isImageMode ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-card/10 px-2.5 py-2">
            <div className="flex flex-wrap gap-1.5">
              {CHAT_OUTPUT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onOutputModeChange(mode.id)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                    outputMode === mode.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                  )}
                  title={mode.description}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {outputMode !== 'chat' ? (
              <select
                value={artifactFormat}
                onChange={(event) => onArtifactFormatChange(event.target.value as ChatArtifactFormatId)}
                className="ml-auto min-w-35 rounded-lg border border-border/70 bg-card/60 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {CHAT_ARTIFACT_FORMATS.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.label}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}
        {isImageMode ? (
          <div className="mb-2 rounded-lg border border-border/50 bg-card/10 px-2.5 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Viitepilt</p>
                <p className="text-xs text-foreground">
                  {referenceImage
                    ? `Kasutan pilti ${referenceImage.name} image-to-image lähtepunktina.`
                    : 'Lae üles pilt, kui tahad olemasoleva kompositsiooni või subjekti peale edasi ehitada.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReferencePickerOpen}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {referenceImage ? 'Vaheta pilti' : 'Lae pilt'}
                </button>
                {referenceImage ? (
                  <button
                    type="button"
                    onClick={onReferenceImageRemove}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary"
                  >
                    <X className="h-3.5 w-3.5" />
                    Eemalda
                  </button>
                ) : null}
              </div>
            </div>
            {referenceImage ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-[96px_1fr] sm:items-start">
                <Image
                  src={referenceImage.dataUrl}
                  alt={referenceImage.name}
                  width={96}
                  height={96}
                  unoptimized
                  className="h-24 w-24 rounded-lg border border-border/60 object-cover"
                />
                <label className="flex flex-col gap-1">
                  <span className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <span>Muutmise tugevus</span>
                    <span>{imageToImageStrength}%</span>
                  </span>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={imageToImageStrength}
                    onChange={(event) =>
                      onImageToImageStrengthChange(Number(event.target.value))
                    }
                    className="w-full accent-primary"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Madalam hoiab algpilti rohkem, kõrgem lubab suuremaid muudatusi.
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-card/10 px-2.5 py-2">
          <button
            type="button"
            onClick={() => setControlsOpen((current) => !current)}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Seaded</p>
              <p className="truncate text-xs text-foreground">{controlsSummary}</p>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {controlsOpen ? 'Peida' : 'Muuda'}
            </span>
          </button>
        </div>
        {controlsOpen ? (
          <div className="mb-2">
            <HubControls
              isImageMode={isImageMode}
              textModelId={textModelId}
              promptProfileId={promptProfileId}
              imageProviderId={imageProviderId}
              imageAspectRatioId={imageAspectRatioId}
              imageStylePresetId={imageStylePresetId}
              imageSeed={imageSeed}
              imageVariationStrength={imageVariationStrength}
              imagePipelineId={imagePipelineId}
              enhancePrompt={enhancePrompt}
              backendHealth={backendHealth}
              onTextModelChange={onTextModelChange}
              onPromptProfileChange={onPromptProfileChange}
              onImageProviderChange={onImageProviderChange}
              onImageAspectRatioChange={onImageAspectRatioChange}
              onImageStylePresetChange={onImageStylePresetChange}
              onImageSeedChange={onImageSeedChange}
              onImageVariationStrengthChange={onImageVariationStrengthChange}
              onImagePipelineChange={onImagePipelineChange}
              onEnhancePromptChange={onEnhancePromptChange}
            />
          </div>
        ) : null}
        {canCancel ? (
          <div className="mb-2 flex items-center justify-between rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <span>Aktiivne tegevus käib. Soovi korral saad selle kohe peatada.</span>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-1.5 font-medium text-amber-100 transition-colors hover:bg-amber-500/25"
            >
              <Loader2 className={cn('h-3.5 w-3.5', isLoading ? 'animate-spin' : '')} />
              Peata tegevus
            </button>
          </div>
        ) : null}
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
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || canCancel}
            className={cn(
              'flex min-w-9 shrink-0 items-center justify-center rounded-xl px-3 transition-all',
              input.trim() && !canCancel
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'bg-secondary text-muted-foreground'
            )}
            title="Saada"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-center text-xs text-red-400">
            {error}
          </p>
        ) : (
          <p id={helperTextId} className="mt-2 text-center text-xs text-muted-foreground">
            {isImageMode
              ? 'Parim kvaliteet: subjekt + tegevus + koht + valgus + stiil + kaader. Vaikimisi kasutatakse kvaliteedipipeline\'i.'
              : outputMode === 'chat'
                ? 'Vestlusreziim annab tavalise vastuse. Faili või ZIP-i jaoks vali vastav intent.'
                : outputMode === 'file'
                  ? 'Failireziim sunnib mudelit looma allalaetava faili. PDF ja DOCX koostatakse UI-s päris dokumendiks.'
                  : 'ZIP-reziim sunnib mudelit looma mitu seotud faili, mida saab ühe paketina alla laadida.'}
          </p>
        )}
      </div>
    </div>
  )
}

