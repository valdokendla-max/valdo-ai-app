export type TextModelId = 'llama-3.3-70b' | 'llama-3.1-8b'

export type PromptProfileId = 'balanced' | 'precise' | 'creative'

export type ImageProviderId = 'auto' | 'automatic1111' | 'comfyui' | 'replicate'

export type ImagePipelineId = 'fast' | 'balanced' | 'quality'

export type ImageAspectRatioId = '1:1' | '4:5' | '3:2' | '16:9'

export type ImageStylePresetId =
  | 'natural'
  | 'cinematic'
  | 'illustration'
  | 'anime'
  | 'product'
  | 'logo'

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
    promptStyle:
      'balanced detail, crisp focus, cinematic light, grounded proportions, coherent scene, clean edges',
    upscaleFactor: 2.25,
    comfy: {
      width: 640,
      height: 640,
      steps: 16,
      cfg: 4.2,
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
    promptStyle:
      'high detail, sharp focus, crisp edges, refined lighting, realistic materials, polished finish, strong subject separation, accurate anatomy',
    upscaleFactor: 3,
    comfy: {
      width: 832,
      height: 832,
      steps: 28,
      cfg: 5.5,
      sampler: 'dpmpp_2m',
      scheduler: 'karras',
    },
    replicate: {
      aspectRatio: '1:1',
      outputQuality: 100,
    },
  },
] as const

export const IMAGE_ASPECT_RATIOS = [
  {
    id: '1:1' as const,
    label: '1:1 ruut',
    description: 'Universaalne ruutformaat',
    widthRatio: 1,
    heightRatio: 1,
  },
  {
    id: '4:5' as const,
    label: '4:5 portree',
    description: 'Sobib portreede ja sotsiaalmeedia postituste jaoks',
    widthRatio: 4,
    heightRatio: 5,
  },
  {
    id: '3:2' as const,
    label: '3:2 maastik',
    description: 'Tasakaalus fotoformaat',
    widthRatio: 3,
    heightRatio: 2,
  },
  {
    id: '16:9' as const,
    label: '16:9 lai',
    description: 'Laiem kaader stseenidele ja taustapiltidele',
    widthRatio: 16,
    heightRatio: 9,
  },
] as const

export const IMAGE_STYLE_PRESETS = [
  {
    id: 'natural' as const,
    label: 'Naturaalne',
    description: 'Realistlik ja neutraalne visuaal',
    promptStyle: 'natural color balance, realistic lighting, authentic textures',
    negativePrompt: 'oversaturated, overly stylized, cartoon look',
  },
  {
    id: 'cinematic' as const,
    label: 'Cinematic',
    description: 'Dramaatilisem valgus ja filmilik kaader',
    promptStyle: 'cinematic framing, dramatic light, rich contrast, film still aesthetic',
    negativePrompt: 'flat lighting, bland composition, low contrast',
  },
  {
    id: 'illustration' as const,
    label: 'Illustratsioon',
    description: 'Pehmem joonistuslik või concept-art laad',
    promptStyle: 'digital illustration, clean linework, painterly shading, concept art finish',
    negativePrompt: 'photo artifacts, camera noise, realistic skin pores',
  },
  {
    id: 'anime' as const,
    label: 'Anime',
    description: 'Anime või manga suunitlusega tulemus',
    promptStyle: 'anime style, expressive line art, cel shading, stylized composition',
    negativePrompt: 'photorealistic skin, live-action look, muddy shading',
  },
  {
    id: 'product' as const,
    label: 'Tootefoto',
    description: 'Puhas tootefoto või renderilaadne väljund',
    promptStyle: 'product photography, studio lighting, isolated subject, premium commercial look',
    negativePrompt: 'cluttered background, warped product shape, busy scene',
  },
  {
    id: 'logo' as const,
    label: 'Logo/Icon',
    description: 'Lihtsam märk, ikoon või embleem',
    promptStyle: 'vector logo style, clean silhouette, minimal palette, centered emblem',
    negativePrompt: 'photorealistic texture, clutter, complex background, messy details',
  },
] as const

export const DEFAULT_TEXT_MODEL_ID: TextModelId = 'llama-3.3-70b'
export const DEFAULT_PROMPT_PROFILE_ID: PromptProfileId = 'balanced'
export const DEFAULT_IMAGE_PROVIDER_ID: ImageProviderId = 'auto'
export const DEFAULT_IMAGE_PIPELINE_ID: ImagePipelineId = 'quality'
export const DEFAULT_IMAGE_ASPECT_RATIO_ID: ImageAspectRatioId = '1:1'
export const DEFAULT_IMAGE_STYLE_PRESET_ID: ImageStylePresetId = 'natural'

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

export function getImageAspectRatio(aspectRatioId?: string) {
  return (
    IMAGE_ASPECT_RATIOS.find((aspectRatio) => aspectRatio.id === aspectRatioId) ??
    IMAGE_ASPECT_RATIOS[0]
  )
}

export function getDimensionsForAspectRatio(
  baseWidth: number,
  baseHeight: number,
  aspectRatioId?: string
) {
  const aspectRatio = getImageAspectRatio(aspectRatioId)
  const longEdge = Math.max(baseWidth, baseHeight)
  const scale = longEdge / Math.max(aspectRatio.widthRatio, aspectRatio.heightRatio)

  return {
    width: Math.max(64, Math.round(aspectRatio.widthRatio * scale)),
    height: Math.max(64, Math.round(aspectRatio.heightRatio * scale)),
    aspectRatio: aspectRatio.id,
  }
}

export function getImageStylePreset(stylePresetId?: string) {
  return IMAGE_STYLE_PRESETS.find((preset) => preset.id === stylePresetId) ?? IMAGE_STYLE_PRESETS[0]
}