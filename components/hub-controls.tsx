'use client'

import {
  DEFAULT_IMAGE_ASPECT_RATIO_ID,
  DEFAULT_IMAGE_PIPELINE_ID,
  DEFAULT_IMAGE_PROVIDER_ID,
  DEFAULT_IMAGE_SAFETY_MODE_ID,
  DEFAULT_PROMPT_PROFILE_ID,
  DEFAULT_TEXT_MODEL_ID,
  DEFAULT_IMAGE_STYLE_PRESET_ID,
  IMAGE_ASPECT_RATIOS,
  IMAGE_PIPELINES,
  IMAGE_PROVIDERS,
  IMAGE_SAFETY_MODES,
  IMAGE_STYLE_PRESETS,
  PROMPT_PROFILES,
  TEXT_MODELS,
  type ImageAspectRatioId,
  type ImagePipelineId,
  type ImageProviderId,
  type ImageSafetyModeId,
  type ImageStylePresetId,
  type PromptProfileId,
  type TextModelId,
} from '@/lib/ai-hub'

interface HubControlsProps {
  isImageMode: boolean
  textModelId: TextModelId
  promptProfileId: PromptProfileId
  imageProviderId: ImageProviderId
  imageAspectRatioId: ImageAspectRatioId
  imageStylePresetId: ImageStylePresetId
  imageSeed: number | null
  imageVariationStrength: number
  imagePipelineId: ImagePipelineId
  imageAdultOnly: boolean
  imageSafetyModeId: ImageSafetyModeId
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
  onImagePipelineChange: (value: ImagePipelineId) => void
  onImageAdultOnlyChange: (value: boolean) => void
  onImageSafetyModeChange: (value: ImageSafetyModeId) => void
  onEnhancePromptChange: (value: boolean) => void
}

const baseSelectClassName =
  'w-full rounded-lg border border-border/70 bg-card/60 px-2.5 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30'

export function HubControls({
  isImageMode,
  textModelId,
  promptProfileId,
  imageProviderId,
  imageAspectRatioId,
  imageStylePresetId,
  imageSeed,
  imageVariationStrength,
  imagePipelineId,
  imageAdultOnly,
  imageSafetyModeId,
  enhancePrompt,
  backendHealth,
  onTextModelChange,
  onPromptProfileChange,
  onImageProviderChange,
  onImageAspectRatioChange,
  onImageStylePresetChange,
  onImageSeedChange,
  onImageVariationStrengthChange,
  onImagePipelineChange,
  onImageAdultOnlyChange,
  onImageSafetyModeChange,
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

  const tertiaryDescription = isImageMode
    ? IMAGE_ASPECT_RATIOS.find((aspectRatio) => aspectRatio.id === imageAspectRatioId)
        ?.description ||
      IMAGE_ASPECT_RATIOS.find((aspectRatio) => aspectRatio.id === DEFAULT_IMAGE_ASPECT_RATIO_ID)
        ?.description
    : null

  const quaternaryDescription = isImageMode
    ? IMAGE_STYLE_PRESETS.find((preset) => preset.id === imageStylePresetId)?.description ||
      IMAGE_STYLE_PRESETS.find((preset) => preset.id === DEFAULT_IMAGE_STYLE_PRESET_ID)?.description
    : null

  const quinaryDescription = isImageMode
    ? IMAGE_SAFETY_MODES.find((mode) => mode.id === imageSafetyModeId)?.description ||
      IMAGE_SAFETY_MODES.find((mode) => mode.id === DEFAULT_IMAGE_SAFETY_MODE_ID)?.description
    : null

  return (
    <div className="grid gap-1.5 rounded-xl border border-border/50 bg-card/20 p-2 sm:grid-cols-2">
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

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Kuvasuhe
            </span>
            <select
              value={imageAspectRatioId}
              onChange={(event) =>
                onImageAspectRatioChange(event.target.value as ImageAspectRatioId)
              }
              className={baseSelectClassName}
            >
              {IMAGE_ASPECT_RATIOS.map((aspectRatio) => (
                <option key={aspectRatio.id} value={aspectRatio.id}>
                  {aspectRatio.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Stiil
            </span>
            <select
              value={imageStylePresetId}
              onChange={(event) =>
                onImageStylePresetChange(event.target.value as ImageStylePresetId)
              }
              className={baseSelectClassName}
            >
              {IMAGE_STYLE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Seed
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={imageSeed ?? ''}
              onChange={(event) => {
                const value = event.target.value.trim()
                onImageSeedChange(value ? Number(value) : null)
              }}
              placeholder="Juhuslik"
              className={baseSelectClassName}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Turvareziim
            </span>
            <select
              value={imageSafetyModeId}
              onChange={(event) =>
                onImageSafetyModeChange(event.target.value as ImageSafetyModeId)
              }
              className={baseSelectClassName}
            >
              {IMAGE_SAFETY_MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>Variatsioon</span>
              <span>{imageVariationStrength}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={imageVariationStrength}
              onChange={(event) =>
                onImageVariationStrengthChange(Number(event.target.value))
              }
              className="w-full accent-primary"
            />
            <span className="text-[11px] text-muted-foreground">
              {imageSeed === null
                ? 'Tuhja seediga kasutatakse iga kord uut juhuslikku alust.'
                : 'Seadistatud seed hoiab kompositsiooni stabiilsemana; variatsioon lisab kontrollitud erinevust.'}
            </span>
          </label>

          <button
            type="button"
            onClick={() => onImageAdultOnlyChange(!imageAdultOnly)}
            className={`sm:col-span-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              imageAdultOnly
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border bg-card/70 text-muted-foreground'
            }`}
          >
            <span className="block font-medium">18+ ainult subjektid</span>
            <span className="block text-[11px] opacity-80">
              {imageAdultOnly
                ? 'Promptile lisatakse taisealise subjekti kaitsekontekst.'
                : 'Vanusekonteksti ei lisata automaatselt.'}
            </span>
          </button>

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

      <div className="sm:col-span-2 rounded-lg bg-background/40 px-3 py-1.5 text-[11px] text-muted-foreground">
        {primaryDescription}
        {' | '}
        {secondaryDescription}
        {tertiaryDescription ? ` | ${tertiaryDescription}` : ''}
        {quaternaryDescription ? ` | ${quaternaryDescription}` : ''}
        {quinaryDescription ? ` | ${quinaryDescription}` : ''}
      </div>
    </div>
  )
}

