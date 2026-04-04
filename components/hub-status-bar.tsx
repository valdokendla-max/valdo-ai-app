'use client'

import {
  IMAGE_PIPELINES,
  IMAGE_PROVIDERS,
  PROMPT_PROFILES,
  TEXT_MODELS,
  type ImagePipelineId,
  type ImageProviderId,
  type PromptProfileId,
  type TextModelId,
} from '@/lib/ai-hub'

interface HubStatusBarProps {
  isImageMode: boolean
  textModelId: TextModelId
  promptProfileId: PromptProfileId
  imageProviderId: ImageProviderId
  imagePipelineId: ImagePipelineId
  enhancePrompt: boolean
  imageStage?: 'idle' | 'queued' | 'running' | 'enhancing' | 'done' | 'failed'
  backendHealth?: {
    comfyui: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
    replicate: { status: 'connected' | 'configured' | 'missing' | 'error'; detail: string }
  } | null
}

function StatusChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

export function HubStatusBar({
  isImageMode,
  textModelId,
  promptProfileId,
  imageProviderId,
  imagePipelineId,
  enhancePrompt,
  imageStage = 'idle',
  backendHealth,
}: HubStatusBarProps) {
  const textModel = TEXT_MODELS.find((model) => model.id === textModelId)?.label || textModelId
  const promptProfile =
    PROMPT_PROFILES.find((profile) => profile.id === promptProfileId)?.label || promptProfileId
  const imageProvider =
    IMAGE_PROVIDERS.find((provider) => provider.id === imageProviderId)?.label || imageProviderId
  const imagePipeline =
    IMAGE_PIPELINES.find((pipeline) => pipeline.id === imagePipelineId)?.label || imagePipelineId

  const imageStageLabelMap = {
    idle: 'Ootel',
    queued: 'Queued',
    running: 'Running',
    enhancing: 'Enhancing',
    done: 'Done',
    failed: 'Failed',
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

  return (
    <div className="border-b border-border/70 bg-background/70 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-4">
        <StatusChip label="Reziim" value={isImageMode ? 'Pilt' : 'Tekst'} />
        {isImageMode ? (
          <>
            <StatusChip label="Backend" value={imageProvider} />
            <StatusChip label="Pipeline" value={imagePipeline} />
            <StatusChip label="Enhance" value={enhancePrompt ? 'Sees' : 'Väljas'} />
            <StatusChip label="Staatus" value={imageStageLabelMap[imageStage]} />
          </>
        ) : (
          <>
            <StatusChip label="Mudeli valik" value={textModel} />
            <StatusChip label="Prompti profiil" value={promptProfile} />
            <StatusChip label="Pildi backend" value={imageProvider} />
          </>
        )}
      </div>
      {backendHealth ? (
        <div className="mx-auto mt-2 flex max-w-3xl flex-wrap gap-2">
          {[
            { label: 'ComfyUI', entry: backendHealth.comfyui },
            { label: 'Replicate', entry: backendHealth.replicate },
          ].map(({ label, entry }) => (
            <div
              key={label}
              className={`rounded-full border px-3 py-1 text-xs ${healthTone[entry.status]}`}
            >
              {label}: {healthLabel[entry.status]} · {entry.detail}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}