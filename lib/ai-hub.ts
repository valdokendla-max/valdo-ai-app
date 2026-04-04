export type TextModelId = 'llama-3.3-70b' | 'llama-3.1-8b'

export type PromptProfileId = 'balanced' | 'precise' | 'creative'

export type ImageProviderId = 'auto' | 'automatic1111' | 'comfyui' | 'replicate'

export type ImagePipelineId = 'fast' | 'balanced' | 'quality'

export const TEXT_MODELS = [
  {
    id: 'llama-3.3-70b' as const,
    label: 'Llama 3.3 70B',
    description: 'Tugevam üldmudel pikemateks ja täpsemateks vastusteks',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
  },
  {
    id: 'llama-3.1-8b' as const,
    label: 'Llama 3.1 8B',
    description: 'Kiirem mudel lühemateks ja odavamateks vastusteks',
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
  },
] as const

export const PROMPT_PROFILES = [
  {
    id: 'balanced' as const,
    label: 'Tasakaalus',
    description: 'Üldotstarbeline profiil',
    systemSuffix:
      'Hoia vastused selged, praktilised ja proportsionaalselt detailsed.',
  },
  {
    id: 'precise' as const,
    label: 'Täpne',
    description: 'Lühem, kontrollitum ja struktureeritum vastus',
    systemSuffix:
      'Eelista täpseid samme, selgeid eeldusi ja lühikesi kontrollitavaid väiteid.',
  },
  {
    id: 'creative' as const,
    label: 'Loov',
    description: 'Väljendusrikkam ja ideerikkam profiil',
    systemSuffix:
      'Paku vajadusel rohkem ideid, alternatiive ja väljendusrikkamat sõnastust.',
  },
] as const

export const IMAGE_PROVIDERS = [
  {
    id: 'auto' as const,
    label: 'Auto (failover)',
    description: 'Proovib esmalt peamist backendit ja kukkumisel liigub varuvariandile',
  },
  {
    id: 'automatic1111' as const,
    label: 'Automatic1111',
    description: 'Stable Diffusion WebUI API backend',
  },
  {
    id: 'comfyui' as const,
    label: 'ComfyUI',
    description: 'Lokaalne või ise hostitud pildibackend',
  },
  {
    id: 'replicate' as const,
    label: 'Replicate',
    description: 'Pilvepõhine varubackend pildigeneratsiooniks',
  },
] as const

export const IMAGE_PIPELINES = [
  {
    id: 'fast' as const,
    label: 'Kiire',
    description: 'Madalam kvaliteet, kiirem tulemus',
    promptStyle: 'clear subject, readable composition, clean lighting, coherent scene',
    upscaleFactor: 1.75,
    comfy: {
      width: 448,
      height: 448,
      steps: 6,
      cfg: 3,
      sampler: 'euler',
      scheduler: 'normal',
    },
    replicate: {
      aspectRatio: '1:1',
      outputQuality: 90,
    },
  },
  {
    id: 'balanced' as const,
    label: 'Tasakaalus',
    description: 'Kvaliteedi ja kiiruse kompromiss',
    promptStyle: 'balanced detail, cinematic light, grounded proportions, coherent scene',
    upscaleFactor: 2.25,
    comfy: {
      width: 576,
      height: 576,
      steps: 12,
      cfg: 3.8,
      sampler: 'dpmpp_2m',
      scheduler: 'karras',
    },
    replicate: {
      aspectRatio: '1:1',
      outputQuality: 95,
    },
  },
  {
    id: 'quality' as const,
    label: 'Kvaliteet',
    description: 'Rohkem samme ja detaili, aeglasem töö',
    promptStyle: 'high detail, refined lighting, realistic materials, polished finish, strong subject separation',
    upscaleFactor: 2.75,
    comfy: {
      width: 704,
      height: 704,
      steps: 20,
      cfg: 5,
      sampler: 'dpmpp_2m',
      scheduler: 'karras',
    },
    replicate: {
      aspectRatio: '1:1',
      outputQuality: 100,
    },
  },
] as const

export const DEFAULT_TEXT_MODEL_ID: TextModelId = 'llama-3.3-70b'
export const DEFAULT_PROMPT_PROFILE_ID: PromptProfileId = 'balanced'
export const DEFAULT_IMAGE_PROVIDER_ID: ImageProviderId = 'auto'
export const DEFAULT_IMAGE_PIPELINE_ID: ImagePipelineId = 'balanced'

export function getTextModel(modelId?: string) {
  return TEXT_MODELS.find((model) => model.id === modelId) ?? TEXT_MODELS[0]
}

export function getPromptProfile(profileId?: string) {
  return PROMPT_PROFILES.find((profile) => profile.id === profileId) ?? PROMPT_PROFILES[0]
}

export function getImageProvider(providerId?: string) {
  return IMAGE_PROVIDERS.find((provider) => provider.id === providerId) ?? IMAGE_PROVIDERS[0]
}

export function getImagePipeline(pipelineId?: string) {
  return IMAGE_PIPELINES.find((pipeline) => pipeline.id === pipelineId) ?? IMAGE_PIPELINES[1]
}