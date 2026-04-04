'use client'

import {
  IMAGE_PIPELINES,
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
  const imagePipeline =
    IMAGE_PIPELINES.find((pipeline) => pipeline.id === imagePipelineId)?.label || imagePipelineId

  const imageStageLabelMap = {
    idle: 'Ootel',
    queued: 'Järjekorras',
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

  return (
    <div className="border-b border-border/60 bg-background/60 px-4 py-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl flex-wrap gap-1.5">
        <StatusChip label="Reziim" value={isImageMode ? 'Pilt' : 'Tekst'} />
        {isImageMode ? (
          <>
            <StatusChip label="Pipeline" value={imagePipeline} />
            <StatusChip label="Töövoog" value={enhancePrompt ? '3 sammu' : '1 samm'} />
            <StatusChip label="Staatus" value={imageStageLabelMap[imageStage]} />
          </>
        ) : (
          <>
            <StatusChip label="Mudeli valik" value={textModel} />
            <StatusChip label="Prompti profiil" value={promptProfile} />
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