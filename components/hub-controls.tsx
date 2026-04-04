'use client'

import {
  DEFAULT_IMAGE_PIPELINE_ID,
  DEFAULT_IMAGE_PROVIDER_ID,
  DEFAULT_PROMPT_PROFILE_ID,
  DEFAULT_TEXT_MODEL_ID,
  IMAGE_PIPELINES,
  IMAGE_PROVIDERS,
  PROMPT_PROFILES,
  TEXT_MODELS,
  type ImagePipelineId,
  type ImageProviderId,
  type PromptProfileId,
  type TextModelId,
} from '@/lib/ai-hub'

interface HubControlsProps {
  isImageMode: boolean
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

const baseSelectClassName =
  'w-full rounded-lg border border-border/70 bg-card/70 px-2.5 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30'

export function HubControls({
  isImageMode,
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
}: HubControlsProps) {
  const availableImageProviders = IMAGE_PROVIDERS.filter((provider) => {
    if (!isImageMode) {
      return true
    }

    if (!backendHealth) {
      return provider.id !== 'replicate'
    }

    if (provider.id === 'automatic1111') {
      return backendHealth.automatic1111.status !== 'missing'
    }

    if (provider.id === 'replicate') {
      return backendHealth.replicate.status !== 'missing'
    }

    if (provider.id === 'auto') {
      return (
        backendHealth.automatic1111.status !== 'missing' ||
        backendHealth.comfyui.status !== 'missing' ||
        backendHealth.replicate.status !== 'missing'
      )
    }

    return backendHealth.comfyui.status !== 'missing'
  })

  const primaryDescription = isImageMode
    ? availableImageProviders.find((provider) => provider.id === imageProviderId)?.description ||
      IMAGE_PROVIDERS.find((provider) => provider.id === DEFAULT_IMAGE_PROVIDER_ID)?.description
    : TEXT_MODELS.find((model) => model.id === textModelId)?.description ||
      TEXT_MODELS.find((model) => model.id === DEFAULT_TEXT_MODEL_ID)?.description

  const secondaryDescription = isImageMode
    ? IMAGE_PIPELINES.find((pipeline) => pipeline.id === imagePipelineId)?.description ||
      IMAGE_PIPELINES.find((pipeline) => pipeline.id === DEFAULT_IMAGE_PIPELINE_ID)?.description
    : PROMPT_PROFILES.find((profile) => profile.id === promptProfileId)?.description ||
      PROMPT_PROFILES.find((profile) => profile.id === DEFAULT_PROMPT_PROFILE_ID)?.description

  return (
    <div className="grid gap-1.5 rounded-xl border border-border/60 bg-card/30 p-2.5 sm:grid-cols-2">
      {isImageMode ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Pildi backend
            </span>
            <select
              value={imageProviderId}
              onChange={(event) => onImageProviderChange(event.target.value as ImageProviderId)}
              className={baseSelectClassName}
            >
              {availableImageProviders.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Pipeline
            </span>
            <select
              value={imagePipelineId}
              onChange={(event) => onImagePipelineChange(event.target.value as ImagePipelineId)}
              className={baseSelectClassName}
            >
              {IMAGE_PIPELINES.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => onEnhancePromptChange(!enhancePrompt)}
            className={`sm:col-span-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              enhancePrompt
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border bg-card/70 text-muted-foreground'
            }`}
          >
            <span className="block font-medium">3-sammuline töötlus</span>
            <span className="block text-[11px] opacity-80">
              {enhancePrompt
                ? 'Prompt täpsustatakse, pilt genereeritakse ja lõpus tehakse upscale.'
                : 'Kasutatakse ühte otsegeneratsiooni sammu ilma täiendava töötluseta.'}
            </span>
          </button>
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Tekstimudel
            </span>
            <select
              value={textModelId}
              onChange={(event) => onTextModelChange(event.target.value as TextModelId)}
              className={baseSelectClassName}
            >
              {TEXT_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Prompti profiil
            </span>
            <select
              value={promptProfileId}
              onChange={(event) => onPromptProfileChange(event.target.value as PromptProfileId)}
              className={baseSelectClassName}
            >
              {PROMPT_PROFILES.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <div className="sm:col-span-2 rounded-lg bg-background/50 px-3 py-1.5 text-[11px] text-muted-foreground">
        {primaryDescription} {' · '} {secondaryDescription}
      </div>
    </div>
  )
}