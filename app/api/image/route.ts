import { groq } from '@ai-sdk/groq'
import { generateText } from 'ai'
import sharp from 'sharp'
import {
  getDimensionsForAspectRatio,
  getImagePipeline,
  getImageProvider,
  getImageStylePreset,
} from '@/lib/ai-hub'
import {
  isBackendCoolingDown,
  recordBackendFailure,
  recordBackendSuccess,
  sortProvidersForAuto,
  type RuntimeImageProviderId,
} from '@/lib/image-backend-runtime'
import { imageRequestSchema } from '@/lib/server/api-schemas'
import {
  createValidationErrorResponse,
  parseJsonBody,
} from '@/lib/server/request-validation'

export const maxDuration = 300

const DEFAULT_NEGATIVE_PROMPT =
  'low quality, lowres, blurry, soft focus, out of focus, distorted, deformed, bad anatomy, bad hands, extra fingers, extra limbs, duplicate, cropped, watermark, text, logo, oversmoothed, washed out, muddy details, jpeg artifacts'

const DEFAULT_IMAGE_STYLE_PROMPT =
  'best quality, highly detailed, crisp focus, cinematic lighting, realistic composition, clean anatomy, coherent subject, readable background, natural textures, well-defined edges'

const DEFAULT_REPLICATE_MODEL = 'black-forest-labs/flux-schnell'
const DEFAULT_REPLICATE_ULTRA_MODEL = 'black-forest-labs/flux-dev'
const POLLINATIONS_BASE_URL = 'https://image.pollinations.ai/prompt'
const POLLINATIONS_MAX_ATTEMPTS = 3
const POLLINATIONS_RETRY_DELAY_MS = 1_500
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const ALLOWED_CLIENT_IMAGE_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const ALLOWED_REPLICATE_IMAGE_HOSTS = ['replicate.delivery', '.replicate.delivery']
const MINOR_SAFETY_NEGATIVE_PROMPT =
  'child, children, kid, kids, teen, teenager, underage, minor, adolescent, infant, toddler, baby face'
const MINOR_REFERENCE_PATTERN =
  /\b(child(?:ren)?|kid(?:s)?|teen(?:ager)?s?|teenage|underage|minor(?:s)?|preteen|schoolgirl|schoolboy|loli|lolicon|shota)\b/i
const ILLEGAL_CONTENT_PATTERN =
  /\b(rape|raping|non[-\s]?consensual|incest|bestiality)\b/i

const IMAGE_PROMPT_SYSTEM =
  'You optimize prompts for high-end text-to-image models. Rewrite the user request into one concise but richly descriptive English prompt. Preserve the exact requested subject, action, scene, camera angle, mood, clothing, colors, material details, and composition. Translate Estonian or mixed-language requests into natural English. Strengthen only image-relevant quality cues such as lighting, lens/framing, depth, anatomy, textures, separation, and scene coherence. Respect any provided style preset, aspect ratio, and quality target. Do not add unrelated objects, story details, extra characters, text overlays, watermarks, or brand names unless explicitly requested. Return only the final prompt, with no quotes, labels, bullets, or markdown.'

function isReplicateAutoAllowed() {
  const explicitFlag = process.env.ALLOW_REPLICATE_AUTO

  if (explicitFlag === 'false') {
    return false
  }

  if (explicitFlag === 'true') {
    return true
  }

  return false
}

function isPollinationsFallbackAllowed() {
  const explicitFlag = process.env.ALLOW_POLLINATIONS_FALLBACK

  if (explicitFlag === 'false') {
    return false
  }

  return true
}

type ComfyImage = {
  filename: string
  subfolder?: string
  type?: string
}

type ImageJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'not_found'

type ImageStatusResponse = {
  status: ImageJobStatus
  imageDataUrl?: string
  error?: string
}

function parseDataUrl(input: string) {
  const match = input.match(/^data:([^;]+);base64,(.+)$/)

  if (!match) {
    return null
  }

  const [, contentType, base64] = match
  return {
    contentType,
    buffer: Buffer.from(base64, 'base64'),
  }
}

function normalizeImageContentType(contentType: string) {
  const normalized = contentType.trim().toLowerCase()

  if (normalized === 'image/jpg') {
    return 'image/jpeg'
  }

  return normalized
}

function assertSupportedClientImage(fieldName: string, imageSource: string) {
  const dataUrl = parseDataUrl(imageSource)

  if (!dataUrl) {
    throw new Error(`${fieldName} peab olema base64 data URL kujul data:image/...;base64,...`)
  }

  const contentType = normalizeImageContentType(dataUrl.contentType)

  if (!ALLOWED_CLIENT_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new Error(`${fieldName} peab olema PNG, JPEG või WebP pilt.`)
  }

  if (dataUrl.buffer.byteLength === 0) {
    throw new Error(`${fieldName} on tühi või vigane.`)
  }

  if (dataUrl.buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`${fieldName} on liiga suur. Maksimaalne lubatud suurus on 20 MB.`)
  }

  return {
    contentType,
    buffer: dataUrl.buffer,
  }
}

function readClientImageBuffer(fieldName: string, imageSource: string) {
  return assertSupportedClientImage(fieldName, imageSource).buffer
}

function isAllowedRemoteHost(hostname: string, allowedHosts: string[]) {
  const normalizedHostname = hostname.toLowerCase()

  return allowedHosts.some((allowedHost) => {
    const normalizedAllowedHost = allowedHost.toLowerCase()

    if (normalizedAllowedHost.startsWith('.')) {
      return normalizedHostname.endsWith(normalizedAllowedHost)
    }

    return normalizedHostname === normalizedAllowedHost
  })
}

async function fetchTrustedRemoteImageAsDataUrl(
  imageUrl: string,
  signal: AbortSignal,
  allowedHosts: string[]
) {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(imageUrl)
  } catch {
    throw new Error('Pildi kaug-URL on vigane.')
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Pildi kaug-URL peab kasutama HTTPS-i.')
  }

  if (!isAllowedRemoteHost(parsedUrl.hostname, allowedHosts)) {
    throw new Error('Pildi kaug-host ei ole lubatud.')
  }

  const response = await fetch(parsedUrl, {
    signal,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Trusted image fetch failed: ${response.status}.`)
  }

  const contentType = normalizeImageContentType(
    response.headers.get('content-type') || 'image/png'
  )

  if (!ALLOWED_CLIENT_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new Error('Trusted image fetch returned an unsupported content type.')
  }

  const buffer = Buffer.from(await response.arrayBuffer())

  if (buffer.byteLength === 0) {
    throw new Error('Trusted image fetch returned an empty image.')
  }

  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Trusted image fetch returned an image that is too large.')
  }

  return `data:${contentType};base64,${buffer.toString('base64')}`
}

async function upscaleGeneratedImage(
  imageSource: string,
  factor: number,
  signal?: AbortSignal
) {
  if (factor <= 1) {
    return imageSource
  }

  const sourceBuffer = readClientImageBuffer('imageDataUrl', imageSource)
  const metadata = await sharp(sourceBuffer).metadata()

  if (!metadata.width || !metadata.height) {
    throw new Error('Generated image dimensions could not be determined for upscale.')
  }

  const width = Math.max(1, Math.round(metadata.width * factor))
  const height = Math.max(1, Math.round(metadata.height * factor))

  const upscaledBuffer = await sharp(sourceBuffer)
    .resize({
      width,
      height,
      kernel: sharp.kernel.lanczos3,
      fit: 'fill',
    })
    .png()
    .toBuffer()

  return `data:image/png;base64,${upscaledBuffer.toString('base64')}`
}

async function prepareReferenceImageBase64(
  imageSource: string,
  width: number,
  height: number,
  signal?: AbortSignal
) {
  const sourceBuffer = readClientImageBuffer('referenceImageDataUrl', imageSource)

  return sharp(sourceBuffer)
    .resize({
      width,
      height,
      // Preserve the full reference image instead of cropping it to the target ratio.
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer()
    .then((buffer) => buffer.toString('base64'))
}

function getComfyAuthHeaders() {
  const headers: HeadersInit = {}

  if (process.env.COMFYUI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.COMFYUI_API_KEY}`
  }

  return headers
}

function getComfyJsonHeaders() {
  return {
    ...getComfyAuthHeaders(),
    'Content-Type': 'application/json',
  }
}

function getNumericEnv(name: string, fallback: number) {
  const value = process.env[name]

  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function getComfyEffectiveSettings(
  pipeline: ReturnType<typeof getImagePipeline>,
  aspectRatioId?: string,
  referenceImageMode?: boolean
) {
  const baseDimensions = getDimensionsForAspectRatio(
    getNumericEnv('COMFYUI_WIDTH', pipeline.comfy.width),
    getNumericEnv('COMFYUI_HEIGHT', pipeline.comfy.height),
    aspectRatioId
  )

  const tunnelMode = (process.env.COMFYUI_BASE_URL || '').includes('trycloudflare.com')

  if (!referenceImageMode) {
    return {
      dimensions: baseDimensions,
      steps: getNumericEnv('COMFYUI_STEPS', pipeline.comfy.steps),
      cfg: getNumericEnv('COMFYUI_CFG', pipeline.comfy.cfg),
      samplerName: process.env.COMFYUI_SAMPLER || pipeline.comfy.sampler,
      scheduler: process.env.COMFYUI_SCHEDULER || pipeline.comfy.scheduler,
    }
  }

  const longestEdge = tunnelMode ? 320 : 512
  const ratio = baseDimensions.width / Math.max(1, baseDimensions.height)
  const width = ratio >= 1 ? longestEdge : Math.round(longestEdge * ratio)
  const height = ratio >= 1 ? Math.round(longestEdge / ratio) : longestEdge

  return {
    dimensions: {
      width: Math.max(256, Math.round(width / 64) * 64),
      height: Math.max(256, Math.round(height / 64) * 64),
    },
    steps: getNumericEnv('COMFYUI_IMG2IMG_STEPS', Math.min(pipeline.comfy.steps, tunnelMode ? 4 : 10)),
    cfg: getNumericEnv('COMFYUI_IMG2IMG_CFG', Math.min(pipeline.comfy.cfg, tunnelMode ? 3 : 4)),
    samplerName: process.env.COMFYUI_IMG2IMG_SAMPLER || 'euler',
    scheduler: process.env.COMFYUI_IMG2IMG_SCHEDULER || 'normal',
  }
}

function isComfyTunnelMode() {
  return (process.env.COMFYUI_BASE_URL || '').includes('trycloudflare.com')
}

function buildWorkflow(
  prompt: string,
  pipeline: ReturnType<typeof getImagePipeline>,
  aspectRatioId?: string,
  seed?: number,
  negativePrompt?: string,
  referenceImageName?: string,
  denoisingStrength?: number
) {
  const checkpoint = process.env.COMFYUI_CHECKPOINT_NAME

  if (!checkpoint) {
    throw new Error('COMFYUI_CHECKPOINT_NAME is missing.')
  }

  const effectiveSettings = getComfyEffectiveSettings(
    pipeline,
    aspectRatioId,
    Boolean(referenceImageName)
  )
  const resolvedNegativePrompt =
    negativePrompt || process.env.COMFYUI_NEGATIVE_PROMPT || DEFAULT_NEGATIVE_PROMPT

  const workflow: Record<string, unknown> = {
    '3': {
      inputs: {
        seed: seed ?? Math.floor(Math.random() * 1_000_000_000),
        steps: effectiveSettings.steps,
        cfg: effectiveSettings.cfg,
        sampler_name: effectiveSettings.samplerName,
        scheduler: effectiveSettings.scheduler,
        denoise: referenceImageName ? denoisingStrength ?? 0.45 : 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: referenceImageName ? ['10', 0] : ['5', 0],
      },
      class_type: 'KSampler',
    },
    '4': {
      inputs: {
        ckpt_name: checkpoint,
      },
      class_type: 'CheckpointLoaderSimple',
    },
    '6': {
      inputs: {
        text: prompt,
        clip: ['4', 1],
      },
      class_type: 'CLIPTextEncode',
    },
    '7': {
      inputs: {
        text: resolvedNegativePrompt,
        clip: ['4', 1],
      },
      class_type: 'CLIPTextEncode',
    },
    '8': {
      inputs: {
        samples: ['3', 0],
        vae: ['4', 2],
      },
      class_type: 'VAEDecode',
    },
    '9': {
      inputs: {
        filename_prefix: 'ValdoAI',
        images: ['8', 0],
      },
      class_type: 'SaveImage',
    },
  }

  if (referenceImageName) {
    workflow['10'] = {
      inputs: {
        pixels: ['11', 0],
        vae: ['4', 2],
      },
      class_type: 'VAEEncode',
    }
    workflow['11'] = {
      inputs: {
        image: referenceImageName,
      },
      class_type: 'LoadImage',
    }
  } else {
    workflow['5'] = {
      inputs: {
        width: effectiveSettings.dimensions.width,
        height: effectiveSettings.dimensions.height,
        batch_size: 1,
      },
      class_type: 'EmptyLatentImage',
    }
  }

  return workflow
}

function getFirstImage(historyEntry: any): ComfyImage | null {
  const outputs = historyEntry?.outputs

  if (!outputs || typeof outputs !== 'object') {
    return null
  }

  for (const value of Object.values(outputs)) {
    const images = (value as { images?: ComfyImage[] })?.images
    if (images?.length) {
      return images[0]
    }
  }

  return null
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function createBackendSignal(signal: AbortSignal, timeoutMs: number) {
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
}

function buildFallbackImagePrompt(
  prompt: string,
  pipeline: ReturnType<typeof getImagePipeline>,
  stylePresetId?: string
) {
  const stylePreset = getImageStylePreset(stylePresetId)
  return [
    prompt,
    DEFAULT_IMAGE_STYLE_PROMPT,
    pipeline.promptStyle,
    stylePreset.promptStyle,
  ]
    .filter(Boolean)
    .join(', ')
}

function buildNegativePrompt(stylePresetId?: string) {
  const stylePreset = getImageStylePreset(stylePresetId)
  return `${DEFAULT_NEGATIVE_PROMPT}, ${stylePreset.negativePrompt}`
}

function validatePromptSafety(prompt: string) {
  if (MINOR_REFERENCE_PATTERN.test(prompt)) {
    return 'Prompt viitab alaealisele. Kasuta ainult taisealiste subjektide kirjeldusi.'
  }

  if (ILLEGAL_CONTENT_PATTERN.test(prompt)) {
    return 'Prompt sisaldab keelatud voi ebaseaduslikku sisusoovi.'
  }

  return null
}

function buildEffectiveNegativePrompt(stylePresetId?: string) {
  return [buildNegativePrompt(stylePresetId), MINOR_SAFETY_NEGATIVE_PROMPT].join(', ')
}

function resolveImageSeed(seed?: number | null, variationStrength?: number) {
  const baseSeed =
    typeof seed === 'number' && Number.isFinite(seed)
      ? Math.max(0, Math.floor(seed))
      : Math.floor(Math.random() * 1_000_000_000)

  const normalizedVariation = Math.max(0, Math.min(100, variationStrength ?? 0))

  if (normalizedVariation === 0) {
    return baseSeed
  }

  const maxOffset = Math.max(1, Math.round((normalizedVariation / 100) * 250_000))
  const offset = Math.floor((Math.random() * 2 - 1) * maxOffset)

  return Math.max(0, baseSeed + offset)
}

async function optimizeImagePrompt(
  prompt: string,
  signal: AbortSignal,
  pipeline: ReturnType<typeof getImagePipeline>,
  enhancePrompt: boolean,
  stylePresetId?: string,
  aspectRatioId?: string,
  hasReferenceImage?: boolean
) {
  const cleanedPrompt = prompt.trim()

  if (!cleanedPrompt) {
    return cleanedPrompt
  }

  if (!enhancePrompt) {
    return buildFallbackImagePrompt(cleanedPrompt, pipeline, stylePresetId)
  }

  if (!process.env.GROQ_API_KEY) {
    return buildFallbackImagePrompt(cleanedPrompt, pipeline, stylePresetId)
  }

  try {
    const stylePreset = getImageStylePreset(stylePresetId)
    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: IMAGE_PROMPT_SYSTEM,
      prompt: [
        `User request: ${cleanedPrompt}`,
        `Quality target: ${pipeline.label}.`,
        `Pipeline rendering cues: ${pipeline.promptStyle}.`,
        `Style preset: ${stylePreset.label}.`,
        `Style cues: ${stylePreset.promptStyle}.`,
        `Aspect ratio: ${aspectRatioId || '1:1'}.`,
        hasReferenceImage
          ? 'Reference image: yes. Preserve the source composition, silhouette, and subject identity unless the prompt explicitly requests changes.'
          : 'Reference image: no. Build the composition from the prompt alone.',
      ].join('\n'),
      abortSignal: signal,
      temperature: pipeline.id === 'ultra' ? 0.15 : 0.2,
    })

    const optimizedPrompt = result.text.trim().replace(/^"|"$/g, '')

    if (!optimizedPrompt) {
      return buildFallbackImagePrompt(cleanedPrompt, pipeline, stylePresetId)
    }

    return buildFallbackImagePrompt(optimizedPrompt, pipeline, stylePresetId)
  } catch {
    return buildFallbackImagePrompt(cleanedPrompt, pipeline, stylePresetId)
  }
}

async function fetchComfyImageDataUrl(
  baseUrl: string,
  image: ComfyImage,
  signal?: AbortSignal
) {
  const params = new URLSearchParams({
    filename: image.filename,
    subfolder: image.subfolder || '',
    type: image.type || 'output',
  })

  const imageResponse = await fetch(`${baseUrl}/view?${params.toString()}`, {
    headers: process.env.COMFYUI_API_KEY ? getComfyAuthHeaders() : undefined,
    signal,
    cache: 'no-store',
  })

  if (!imageResponse.ok) {
    const error = await imageResponse.text()
    throw new Error(error)
  }

  const contentType = imageResponse.headers.get('content-type') || 'image/png'
  const buffer = Buffer.from(await imageResponse.arrayBuffer())
  return `data:${contentType};base64,${buffer.toString('base64')}`
}

function getHistoryError(historyEntry: any) {
  const status = historyEntry?.status

  if (!status || typeof status !== 'object') {
    return null
  }

  return (
    status?.messages?.find?.(
      (message: unknown) =>
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        (message as { type?: string }).type === 'execution_error'
    ) as { data?: { exception_message?: string } } | undefined
  )?.data?.exception_message || null
}

async function getComfyJobStatus(
  promptId: string,
  signal?: AbortSignal
): Promise<ImageStatusResponse> {
  const baseUrl = process.env.COMFYUI_BASE_URL?.replace(/\/$/, '')

  if (!baseUrl) {
    return {
      status: 'failed',
      error: 'COMFYUI_BASE_URL is missing.',
    }
  }

  const historyResponse = await fetch(`${baseUrl}/history/${promptId}`, {
    headers: getComfyJsonHeaders(),
    signal,
    cache: 'no-store',
  })

  if (!historyResponse.ok) {
    throw new Error(`ComfyUI history request failed with status ${historyResponse.status}.`)
  }

  const history = await historyResponse.json()
  const historyEntry = history?.[promptId]

  if (historyEntry) {
    const image = getFirstImage(historyEntry)

    if (image) {
      return {
        status: 'succeeded',
        imageDataUrl: await fetchComfyImageDataUrl(baseUrl, image, signal),
      }
    }

    const historyError = getHistoryError(historyEntry)
    if (historyError) {
      return {
        status: 'failed',
        error: historyError,
      }
    }
  }

  const queueResponse = await fetch(`${baseUrl}/queue`, {
    headers: getComfyJsonHeaders(),
    signal,
    cache: 'no-store',
  })

  if (!queueResponse.ok) {
    return historyEntry
      ? { status: 'running' }
      : { status: 'not_found', error: 'ComfyUI queue request failed.' }
  }

  const queue = (await queueResponse.json()) as {
    queue_running?: Array<unknown[]>
    queue_pending?: Array<unknown[]>
  }

  const isRunning = (queue.queue_running || []).some((entry) => entry?.[1] === promptId)
  if (isRunning) {
    return { status: 'running' }
  }

  const isQueued = (queue.queue_pending || []).some((entry) => entry?.[1] === promptId)
  if (isQueued) {
    return { status: 'queued' }
  }

  return historyEntry ? { status: 'running' } : { status: 'not_found' }
}

async function queueComfyUIImage(
  prompt: string,
  signal: AbortSignal,
  pipeline: ReturnType<typeof getImagePipeline>,
  aspectRatioId?: string,
  seed?: number,
  negativePrompt?: string,
  referenceImageDataUrl?: string,
  imageToImageStrength?: number
) {
  const baseUrl = process.env.COMFYUI_BASE_URL?.replace(/\/$/, '')

  if (!baseUrl) {
    return null
  }

  const denoisingStrength = Math.max(
    0.05,
    Math.min(1, (imageToImageStrength ?? 45) / 100)
  )

  let referenceImageName: string | undefined

  if (referenceImageDataUrl) {
    const effectiveSettings = getComfyEffectiveSettings(pipeline, aspectRatioId, true)
    const referenceImageBase64 = await prepareReferenceImageBase64(
      referenceImageDataUrl,
      effectiveSettings.dimensions.width,
      effectiveSettings.dimensions.height,
      signal
    )
    const referenceBuffer = Buffer.from(referenceImageBase64, 'base64')
    const formData = new FormData()
    const filename = `valdo-reference-${crypto.randomUUID()}.png`

    formData.append('image', new File([referenceBuffer], filename, { type: 'image/png' }))
    formData.append('type', 'input')
    formData.append('overwrite', 'false')

    const uploadResponse = await fetch(`${baseUrl}/upload/image`, {
      method: 'POST',
      headers: getComfyAuthHeaders(),
      body: formData,
      signal,
    })

    if (!uploadResponse.ok) {
      throw new Error(`ComfyUI image upload failed with status ${uploadResponse.status}.`)
    }

    const uploadResult = (await uploadResponse.json()) as {
      name?: string
      subfolder?: string
    }

    if (!uploadResult.name) {
      throw new Error('ComfyUI image upload did not return a filename.')
    }

    referenceImageName = uploadResult.subfolder
      ? `${uploadResult.subfolder}/${uploadResult.name}`
      : uploadResult.name
  }

  let workflow: Record<string, unknown>

  try {
    workflow = buildWorkflow(
      prompt.trim(),
      pipeline,
      aspectRatioId,
      seed,
      negativePrompt,
      referenceImageName,
      denoisingStrength
    )
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to build ComfyUI workflow.'
    )
  }

  const clientId = crypto.randomUUID()
  const promptResponse = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: getComfyJsonHeaders(),
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    signal,
  })

  if (!promptResponse.ok) {
    const error = await promptResponse.text()
    throw new Error(error)
  }

  const promptData = (await promptResponse.json()) as { prompt_id?: string }

  if (!promptData.prompt_id) {
    throw new Error('ComfyUI did not return a prompt_id.')
  }

  return { promptId: promptData.prompt_id }
}

function formatReplicateError(errorText: string) {
  try {
    const parsed = JSON.parse(errorText) as {
      title?: string
      detail?: string
      status?: number
    }

    if (parsed.status === 402) {
      return 'Replicate krediit on otsas. Ava replicate.com/account/billing ja lisa krediiti.'
    }

    if (parsed.title && parsed.detail) {
      return `Replicate: ${parsed.title}. ${parsed.detail}`
    }

    if (parsed.detail) {
      return `Replicate: ${parsed.detail}`
    }
  } catch {
    // Keep the original error text if it is not valid JSON.
  }

  return `Replicate error: ${errorText}`
}

function formatAutomatic1111Error(errorText: string) {
  try {
    const parsed = JSON.parse(errorText) as {
      error?: string
      detail?: string
      errors?: string[]
    }

    if (parsed.error && parsed.detail) {
      return `Automatic1111: ${parsed.error}. ${parsed.detail}`
    }

    if (parsed.error) {
      return `Automatic1111: ${parsed.error}`
    }

    if (parsed.errors?.length) {
      return `Automatic1111: ${parsed.errors.join(', ')}`
    }
  } catch {
    // Keep the original error text if it is not valid JSON.
  }

  return `Automatic1111 error: ${errorText}`
}

async function createPollinationsImage(
  prompt: string,
  signal: AbortSignal,
  pipeline: ReturnType<typeof getImagePipeline>,
  aspectRatioId?: string,
  seed?: number
) {
  const dimensions = getDimensionsForAspectRatio(
    Math.min(1024, Math.max(256, pipeline.comfy.width)),
    Math.min(1024, Math.max(256, pipeline.comfy.height)),
    aspectRatioId
  )

  const params = new URLSearchParams({
    width: String(dimensions.width),
    height: String(dimensions.height),
    seed: String(seed ?? Math.floor(Math.random() * 1_000_000_000)),
    model: 'flux',
    nologo: 'true',
    private: 'true',
    enhance: 'false',
    safe: 'false',
  })

  let lastError: Error | null = null

  for (let attempt = 0; attempt < POLLINATIONS_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(POLLINATIONS_RETRY_DELAY_MS * attempt)
    }

    try {
      const response = await fetch(
        `${POLLINATIONS_BASE_URL}/${encodeURIComponent(prompt)}?${params.toString()}`,
        {
          signal,
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        const retryable =
          response.status === 429 ||
          response.status >= 500 ||
          /queue full|too many requests/i.test(errorText)

        if (retryable && attempt < POLLINATIONS_MAX_ATTEMPTS - 1) {
          lastError = new Error(`Pollinations error: ${errorText || response.status}`)
          continue
        }

        throw new Error(`Pollinations error: ${errorText || response.status}`)
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg'
      const buffer = Buffer.from(await response.arrayBuffer())

      if (buffer.byteLength === 0) {
        throw new Error('Pollinations did not return image bytes.')
      }

      return `data:${contentType};base64,${buffer.toString('base64')}`
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error('Pollinations request failed.')

      if (signal.aborted) {
        throw normalizedError
      }

      const retryable =
        /fetch failed|timed out|timeout|too many requests/i.test(normalizedError.message)

      if (retryable && attempt < POLLINATIONS_MAX_ATTEMPTS - 1) {
        lastError = normalizedError
        continue
      }

      throw normalizedError
    }
  }

  throw lastError ?? new Error('Pollinations image generation failed.')
}

async function createAutomatic1111Image(
  prompt: string,
  signal: AbortSignal,
  pipeline: ReturnType<typeof getImagePipeline>,
  aspectRatioId?: string,
  seed?: number,
  negativePrompt?: string,
  referenceImageDataUrl?: string,
  imageToImageStrength?: number
) {
  const baseUrl = process.env.AUTOMATIC1111_BASE_URL?.replace(/\/$/, '')

  if (!baseUrl) {
    return null
  }

  const dimensions = getDimensionsForAspectRatio(
    getNumericEnv('AUTOMATIC1111_WIDTH', pipeline.comfy.width),
    getNumericEnv('AUTOMATIC1111_HEIGHT', pipeline.comfy.height),
    aspectRatioId
  )

  const denoisingStrength = Math.max(
    0.05,
    Math.min(1, (imageToImageStrength ?? 45) / 100)
  )
  const endpoint = referenceImageDataUrl ? '/sdapi/v1/img2img' : '/sdapi/v1/txt2img'
  const payload: Record<string, unknown> = {
    prompt,
    negative_prompt:
      negativePrompt || process.env.AUTOMATIC1111_NEGATIVE_PROMPT || DEFAULT_NEGATIVE_PROMPT,
    width: dimensions.width,
    height: dimensions.height,
    steps: getNumericEnv('AUTOMATIC1111_STEPS', pipeline.comfy.steps),
    cfg_scale: getNumericEnv('AUTOMATIC1111_CFG', pipeline.comfy.cfg),
    sampler_name: process.env.AUTOMATIC1111_SAMPLER || pipeline.comfy.sampler,
    seed: seed ?? -1,
    batch_size: 1,
    n_iter: 1,
    send_images: true,
    save_images: false,
  }

  if (referenceImageDataUrl) {
    payload.init_images = [
      await prepareReferenceImageBase64(
        referenceImageDataUrl,
        dimensions.width,
        dimensions.height,
        signal
      ),
    ]
    payload.denoising_strength = denoisingStrength
    payload.resize_mode = 0
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(formatAutomatic1111Error(error))
  }

  const result = (await response.json()) as { images?: string[] }
  const image = result.images?.[0]

  if (!image) {
    throw new Error('Automatic1111 did not return an image.')
  }

  return image.startsWith('data:') ? image : `data:image/png;base64,${image}`
}

async function createReplicateImage(
  prompt: string,
  signal: AbortSignal,
  pipeline: ReturnType<typeof getImagePipeline>,
  aspectRatioId?: string,
  seed?: number
) {
  const token = process.env.REPLICATE_API_TOKEN

  if (!token) {
    return null
  }

  const model =
    pipeline.id === 'ultra'
      ? process.env.REPLICATE_ULTRA_MODEL || DEFAULT_REPLICATE_ULTRA_MODEL
      : process.env.REPLICATE_MODEL || DEFAULT_REPLICATE_MODEL
  const [owner, name] = model.split('/')

  if (!owner || !name) {
    throw new Error('REPLICATE_MODEL must be in the format owner/model-name.')
  }

  const response = await fetch(
    `https://api.replicate.com/v1/models/${owner}/${name}/predictions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        input: {
          prompt,
          aspect_ratio:
            process.env.REPLICATE_ASPECT_RATIO || aspectRatioId || pipeline.replicate.aspectRatio,
          seed,
          output_format: process.env.REPLICATE_OUTPUT_FORMAT || 'png',
          output_quality: getNumericEnv(
            'REPLICATE_OUTPUT_QUALITY',
            pipeline.replicate.outputQuality
          ),
          num_outputs: 1,
        },
      }),
      signal,
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(formatReplicateError(error))
  }

  let prediction = (await response.json()) as {
    id?: string
    status?: string
    output?: string[] | string
    error?: string
    urls?: { get?: string }
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    if (prediction.status === 'succeeded') {
      const output = prediction.output

      if (Array.isArray(output) && output[0]) {
        return output[0].startsWith('data:')
          ? output[0]
          : fetchTrustedRemoteImageAsDataUrl(output[0], signal, ALLOWED_REPLICATE_IMAGE_HOSTS)
      }

      if (typeof output === 'string') {
        return output.startsWith('data:')
          ? output
          : fetchTrustedRemoteImageAsDataUrl(output, signal, ALLOWED_REPLICATE_IMAGE_HOSTS)
      }

      break
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(prediction.error || 'Replicate image generation failed.')
    }

    if (!prediction.urls?.get) {
      break
    }

    await sleep(1500)

    const pollResponse = await fetch(prediction.urls.get, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal,
      cache: 'no-store',
    })

    if (!pollResponse.ok) {
      const error = await pollResponse.text()
      throw new Error(formatReplicateError(error))
    }

    prediction = await pollResponse.json()
  }

  throw new Error('Replicate image generation timed out.')
}

function getAutoProviderOrder(
  pipeline: ReturnType<typeof getImagePipeline>,
  hasReferenceImage: boolean
): RuntimeImageProviderId[] {
  if (hasReferenceImage) {
    return sortProvidersForAuto(['comfyui', 'automatic1111'])
  }

  const allowReplicateAuto = isReplicateAutoAllowed()
  const allowPollinationsFallback = isPollinationsFallbackAllowed()

  const preferredProviders: RuntimeImageProviderId[] = allowReplicateAuto
    ? ['comfyui', 'automatic1111', 'replicate']
    : ['comfyui', 'automatic1111']

  const providersWithFallback: RuntimeImageProviderId[] = allowPollinationsFallback
    ? [...preferredProviders, 'pollinations']
    : preferredProviders

  if (pipeline.id === 'ultra') {
    return sortProvidersForAuto(providersWithFallback)
  }

  if (pipeline.id === 'quality') {
    return sortProvidersForAuto(providersWithFallback)
  }

  return sortProvidersForAuto(providersWithFallback)
}

function getProviderOrder(
  selectedProviderId: RuntimeImageProviderId | 'auto',
  autoProviderOrder: RuntimeImageProviderId[]
) {
  if (selectedProviderId === 'auto') {
    return autoProviderOrder
  }

  return [
    selectedProviderId,
    ...autoProviderOrder.filter((providerId) => providerId !== selectedProviderId),
  ]
}

async function createComfyUIImage(
  prompt: string,
  signal: AbortSignal,
  pipeline: ReturnType<typeof getImagePipeline>
) {
  const queuedJob = await queueComfyUIImage(prompt, signal, pipeline)

  if (!queuedJob) {
    return null
  }

  for (let attempt = 0; attempt < 180; attempt++) {
    await sleep(1000)

    const status = await getComfyJobStatus(queuedJob.promptId, signal)

    if (status.status === 'succeeded' && status.imageDataUrl) {
      return status.imageDataUrl
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'ComfyUI image generation failed.')
    }
  }

  throw new Error('Image generation timed out before ComfyUI returned an image.')
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const promptId = searchParams.get('promptId')

  if (!promptId) {
    return new Response(JSON.stringify({ error: 'promptId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const status = await getComfyJobStatus(promptId, req.signal)

    return new Response(JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Image status check failed.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

export async function POST(req: Request) {
  let body: {
    action?: 'generate' | 'upscale'
    prompt?: string
    providerId?: string
    pipelineId?: string
    aspectRatioId?: string
    stylePresetId?: string
    seed?: number | null
    variationStrength?: number
    enhancePrompt?: boolean
    imageDataUrl?: string
    referenceImageDataUrl?: string
    imageToImageStrength?: number
  }

  try {
    body = await parseJsonBody(req, imageRequestSchema, {
      maxBytes: 28 * 1024 * 1024,
      emptyBodyMessage: 'Pildi body puudub.',
    })
  } catch (error) {
    return createValidationErrorResponse(error, 'Pildi parsimine ebaõnnestus.')
  }

  const {
    action,
    prompt,
    providerId,
    pipelineId,
    aspectRatioId,
    stylePresetId,
    seed,
    variationStrength,
    enhancePrompt,
    imageDataUrl,
    referenceImageDataUrl,
    imageToImageStrength,
  } = body

  if (action === 'upscale') {
    if (!imageDataUrl) {
      return new Response(JSON.stringify({ error: 'imageDataUrl is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      assertSupportedClientImage('imageDataUrl', imageDataUrl)
      const selectedPipeline = getImagePipeline(pipelineId)
      const upscaledImage = await upscaleGeneratedImage(
        imageDataUrl,
        selectedPipeline.upscaleFactor,
        req.signal
      )

      return new Response(
        JSON.stringify({
          imageDataUrl: upscaledImage,
          status: 'done',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Upscale failed.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }

  try {
    const selectedProvider = getImageProvider(providerId)
    const selectedPipeline = getImagePipeline(pipelineId)
    const shouldEnhance = enhancePrompt !== false
    const trimmedPrompt = prompt?.trim() || ''
    const promptSafetyError = validatePromptSafety(trimmedPrompt)

    if (promptSafetyError) {
      return new Response(JSON.stringify({ error: promptSafetyError }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const effectivePrompt = trimmedPrompt
    const resolvedSeed = resolveImageSeed(seed, variationStrength)
    const negativePrompt = buildEffectiveNegativePrompt(stylePresetId)
    const hasReferenceImage = Boolean(referenceImageDataUrl?.trim())

    if (referenceImageDataUrl) {
      assertSupportedClientImage('referenceImageDataUrl', referenceImageDataUrl)
    }

    const useFastComfyReferenceMode =
      hasReferenceImage &&
      isComfyTunnelMode() &&
      (selectedProvider.id === 'auto' || selectedProvider.id === 'comfyui')
    const effectiveEnhancePrompt = useFastComfyReferenceMode ? false : shouldEnhance
    const optimizedPrompt = await optimizeImagePrompt(
      effectivePrompt,
      req.signal,
      selectedPipeline,
      effectiveEnhancePrompt,
      stylePresetId,
      aspectRatioId,
      hasReferenceImage
    )
    const hasAutomatic1111 = Boolean(process.env.AUTOMATIC1111_BASE_URL)
    const hasComfy = Boolean(process.env.COMFYUI_BASE_URL)
    const hasReplicate = Boolean(process.env.REPLICATE_API_TOKEN)
    const hasPollinations = !hasReferenceImage

    if (hasReferenceImage && selectedProvider.id === 'replicate') {
      return new Response(
        JSON.stringify({
          error: 'Viitepildiga image-to-image on praegu toetatud Automatic1111 ja ComfyUI backendidega.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    let imageDataUrl: string | null = null
    let lastError: Error | null = null
    let resolvedProviderId: RuntimeImageProviderId | null = null
    const autoProviderOrder = getAutoProviderOrder(selectedPipeline, hasReferenceImage)
    const providerOrder: RuntimeImageProviderId[] = getProviderOrder(
      selectedProvider.id as RuntimeImageProviderId | 'auto',
      autoProviderOrder
    )

    for (const candidateProvider of providerOrder) {
      const isConfigured =
        (candidateProvider === 'automatic1111' && hasAutomatic1111) ||
        (candidateProvider === 'comfyui' && hasComfy) ||
        (candidateProvider === 'replicate' && hasReplicate) ||
        (candidateProvider === 'pollinations' && hasPollinations)

      if (!isConfigured) {
        continue
      }

      if (
        selectedProvider.id === 'auto' &&
        !hasReferenceImage &&
        candidateProvider !== 'replicate' &&
        isBackendCoolingDown(candidateProvider)
      ) {
        continue
      }

      try {
        if (candidateProvider === 'automatic1111') {
          imageDataUrl = await createAutomatic1111Image(
            optimizedPrompt,
            createBackendSignal(req.signal, 90000),
            selectedPipeline,
            aspectRatioId,
            resolvedSeed,
            negativePrompt,
            referenceImageDataUrl,
            imageToImageStrength
          )
          recordBackendSuccess('automatic1111')
          resolvedProviderId = 'automatic1111'
          break
        }

        if (candidateProvider === 'comfyui') {
          const queuedJob = await queueComfyUIImage(
            optimizedPrompt,
            createBackendSignal(req.signal, 15000),
            selectedPipeline,
            aspectRatioId,
            resolvedSeed,
            negativePrompt,
            referenceImageDataUrl,
            imageToImageStrength
          )

          if (!queuedJob) {
            throw new Error('ComfyUI is not configured.')
          }

          recordBackendSuccess('comfyui')

          return new Response(
            JSON.stringify({
              status: 'queued',
              promptId: queuedJob.promptId,
              shouldUpscale: useFastComfyReferenceMode ? false : shouldEnhance,
              provider: 'comfyui',
              usedSeed: resolvedSeed,
            }),
            {
              status: 202,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        if (candidateProvider === 'pollinations') {
          imageDataUrl = await createPollinationsImage(
            optimizedPrompt,
            createBackendSignal(req.signal, 90000),
            selectedPipeline,
            aspectRatioId,
            resolvedSeed
          )
          recordBackendSuccess('pollinations')
          resolvedProviderId = 'pollinations'
          break
        }

        imageDataUrl = await createReplicateImage(
          optimizedPrompt,
          createBackendSignal(req.signal, 90000),
          selectedPipeline,
          aspectRatioId,
          resolvedSeed
        )
        recordBackendSuccess('replicate')
        resolvedProviderId = 'replicate'
        break
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error(`${candidateProvider} image generation failed.`)
        recordBackendFailure(candidateProvider, lastError.message)
      }
    }

    if (!imageDataUrl && !lastError) {
      lastError = new Error(
        hasReferenceImage
          ? 'Viitepildiga image-to-image jaoks peab olema seadistatud Automatic1111 või ComfyUI backend.'
          : 'No image backend is configured for the selected provider.'
      )
    }

    if (!imageDataUrl) {
      return new Response(
        JSON.stringify({
          error:
            lastError?.message ||
            'No image backend is configured. Add REPLICATE_API_TOKEN for the easiest setup or COMFYUI_BASE_URL for self-hosted generation.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        imageDataUrl,
        provider: resolvedProviderId || selectedProvider.id,
        pipeline: selectedPipeline.id,
        shouldUpscale: useFastComfyReferenceMode ? false : shouldEnhance,
        usedSeed: resolvedSeed,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Image generation failed.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
