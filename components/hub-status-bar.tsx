'use client'

import {
  IMAGE_ASPECT_RATIOS,
  IMAGE_PROVIDERS,
  IMAGE_PIPELINES,
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
import {
  CHAT_ARTIFACT_FORMATS,
  CHAT_OUTPUT_MODES,
  type ChatArtifactFormatId,
  type ChatOutputModeId,
} from '@/lib/chat-output'

interface HubStatusBarProps {
  isImageMode: boolean
  outputMode: ChatOutputModeId
  artifactFormat: ChatArtifactFormatId
  textModelId: TextModelId
  promptProfileId: PromptProfileId
  imageProviderId: ImageProviderId
  imageAspectRatioId: ImageAspectRatioId
  imageStylePresetId: ImageStylePresetId
  imageSeed: number | null
  imageVariationStrength: number
  activeImageProviderId?: ImageProviderId | null
  imagePipelineId: ImagePipelineId
  imageAdultOnly: boolean
  imageSafetyModeId: ImageSafetyModeId
  enhancePrompt: boolean
  imageStage?: 'idle' | 'starting' | 'queued' | 'running' | 'enhancing' | 'done' | 'failed'
  backendHealth?: {
    automatic1111: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
    comfyui: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
    replicate: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
  } | null
}

function isVisibleHealthStatus(status: 'connected' | 'configured' | 'missing' | 'error') {
  return status !== 'missing'
}

function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-26 rounded-lg border border-border/60 bg-card/50 px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-medium text-foreground">{value}</div>
    </div>
  )
}

function InfoPill({ value }: { value: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[11px] text-muted-foreground">
      {value}
    </div>
  )
}

function getBackendCostLabel(providerId: ImageProviderId | null | undefined) {
  if (!providerId || providerId === 'auto') {
    return 'auto'
  }

  if (providerId === 'replicate') {
    return 'tasuline'
  }

  return 'lokaalne'
}

export function HubStatusBar({
  isImageMode,
  outputMode,
  artifactFormat,
  textModelId,
  promptProfileId,
  imageProviderId,
  imageAspectRatioId,
  imageStylePresetId,
  imageSeed,
  imageVariationStrength,
  activeImageProviderId,
  imagePipelineId,
  imageAdultOnly,
  imageSafetyModeId,
  enhancePrompt,
  imageStage = 'idle',
  backendHealth,
}: HubStatusBarProps) {
  const textModel = TEXT_MODELS.find((model) => model.id === textModelId)?.label || textModelId
  const promptProfile =
    PROMPT_PROFILES.find((profile) => profile.id === promptProfileId)?.label || promptProfileId
  const outputModeLabel =
    CHAT_OUTPUT_MODES.find((mode) => mode.id === outputMode)?.label || outputMode
  const artifactFormatLabel =
    CHAT_ARTIFACT_FORMATS.find((format) => format.id === artifactFormat)?.label || artifactFormat
  const imageAspectRatio =
    IMAGE_ASPECT_RATIOS.find((aspectRatio) => aspectRatio.id === imageAspectRatioId)?.label ||
    imageAspectRatioId
  const imageStylePreset =
    IMAGE_STYLE_PRESETS.find((preset) => preset.id === imageStylePresetId)?.label ||
    imageStylePresetId
  const imagePipeline =
    IMAGE_PIPELINES.find((pipeline) => pipeline.id === imagePipelineId)?.label || imagePipelineId
  const imageSafetyMode =
    IMAGE_SAFETY_MODES.find((mode) => mode.id === imageSafetyModeId)?.label || imageSafetyModeId
  const selectedImageProvider =
    IMAGE_PROVIDERS.find((provider) => provider.id === imageProviderId)?.label || imageProviderId
  const activeImageProvider =
    IMAGE_PROVIDERS.find((provider) => provider.id === activeImageProviderId)?.label ||
    activeImageProviderId
  const resolvedDisplayProviderId =
    imageProviderId === 'auto' ? activeImageProviderId || null : imageProviderId
  const backendCostLabel = getBackendCostLabel(resolvedDisplayProviderId)
  const showsFailoverBadge =
    imageProviderId === 'auto' && Boolean(activeImageProviderId) && activeImageProviderId !== 'automatic1111'

  const imageStageLabelMap = {
    idle: 'Valmis',
    starting: 'Saadab',
    queued: 'Valmistub',
    running: 'Genereerib',
    enhancing: 'Täiustab',
    done: 'Valmis',
    failed: 'Viga',
  } as const

  const healthTone = {
    connected: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    configured: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    missing: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    error: 'border-red-500/30 bg-red-500/10 text-red-200',
  } as const

  const healthLabel = {
    connected: 'OK',
    configured: 'Seadistatud',
    missing: 'Puudub',
    error: 'Viga',
  } as const

  const visibleHealthEntries = backendHealth
    ? [
        { label: 'Automatic1111', entry: backendHealth.automatic1111 },
        { label: 'ComfyUI', entry: backendHealth.comfyui },
        { label: 'Replicate', entry: backendHealth.replicate },
      ].filter(({ entry }) => isVisibleHealthStatus(entry.status))
    : []

  const showHealthSection = visibleHealthEntries.some(
    ({ entry }) => entry.status === 'error'
  )

  if (!isImageMode && !showHealthSection) {
    return (
      <div className="border-b border-border/50 bg-background/50 px-4 py-1.5 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl">
          <div className="inline-flex items-center rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[11px] text-muted-foreground">
            {outputMode === 'chat'
              ? 'Tekstireziim · valmis'
              : `Tekstireziim · ${outputModeLabel}${artifactFormat === 'auto' ? '' : ` · ${artifactFormatLabel}`}`}
          </div>
        </div>
      </div>
    )
  }

  if (isImageMode && !showHealthSection) {
    return (
      <div className="border-b border-border/50 bg-background/55 px-4 py-1.5 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-1.5">
          <InfoPill value="Pildireziim" />
          <InfoPill value={`Kuvasuhe · ${imageAspectRatio}`} />
          <InfoPill value={`Stiil · ${imageStylePreset}`} />
          <InfoPill value={`Pipeline · ${imagePipeline}`} />
          <InfoPill value={`Turvareziim | ${imageSafetyMode}`} />
          <InfoPill value={`Vanus | ${imageAdultOnly ? '18+ ainult' : 'tava'}`} />
          <InfoPill value={imageSeed === null ? 'Seed · auto' : `Seed · ${imageSeed}`} />
          <InfoPill value={`Variatsioon · ${imageVariationStrength}%`} />
          <InfoPill value={`Töötlus · ${enhancePrompt ? '3 sammu' : '1 samm'}`} />
          <InfoPill value={`Staatus · ${imageStageLabelMap[imageStage]}`} />
          <InfoPill
            value={`Backend · ${
              imageProviderId === 'auto'
                ? activeImageProvider || 'Auto'
                : selectedImageProvider
            }`}
          />
          <InfoPill value={`Kulu · ${backendCostLabel}`} />
          {showsFailoverBadge ? <InfoPill value="Failover aktiivne" /> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="border-b border-border/60 bg-background/60 px-4 py-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl flex-wrap gap-1.5">
        <StatusChip label="Reziim" value={isImageMode ? 'Pilt' : 'Tekst'} />
        {isImageMode ? (
          <>
            <StatusChip label="Kuvasuhe" value={imageAspectRatio} />
            <StatusChip label="Stiil" value={imageStylePreset} />
            <StatusChip label="Pipeline" value={imagePipeline} />
            <StatusChip label="Turvareziim" value={imageSafetyMode} />
            <StatusChip label="Vanus" value={imageAdultOnly ? '18+ ainult' : 'tava'} />
            <StatusChip label="Seed" value={imageSeed === null ? 'Auto' : String(imageSeed)} />
            <StatusChip label="Variatsioon" value={`${imageVariationStrength}%`} />
            <StatusChip label="Töövoog" value={enhancePrompt ? '3 sammu' : '1 samm'} />
            <StatusChip label="Staatus" value={imageStageLabelMap[imageStage]} />
            <StatusChip label="Kulu" value={backendCostLabel} />
          </>
        ) : (
          <>
            <StatusChip label="Mudeli valik" value={textModel} />
            <StatusChip label="Prompti profiil" value={promptProfile} />
            <StatusChip label="Väljund" value={outputModeLabel} />
            {outputMode !== 'chat' ? (
              <StatusChip label="Formaat" value={artifactFormatLabel} />
            ) : null}
            <StatusChip label="Staatus" value="Valmis" />
          </>
        )}
      </div>
      {showHealthSection ? (
        <div className="mx-auto mt-1 flex max-w-3xl flex-wrap gap-1.5">
          {visibleHealthEntries.map(({ label, entry }) => (
            <div
              key={label}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${healthTone[entry.status]}`}
            >
              {label}: {healthLabel[entry.status]} · {entry.detail}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

