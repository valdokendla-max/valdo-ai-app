import { groq } from '@ai-sdk/groq'
import { generateText } from 'ai'
import sharp from 'sharp'
import { getImagePipeline, getImageProvider } from '@/lib/ai-hub'

export const maxDuration = 300

const DEFAULT_NEGATIVE_PROMPT =
  'low quality, lowres, blurry, out of focus, distorted, deformed, bad anatomy, bad hands, extra fingers, extra limbs, duplicate, cropped, watermark, text, logo'

const DEFAULT_IMAGE_STYLE_PROMPT =
  'best quality, highly detailed, cinematic lighting, sharp focus, realistic composition, clean anatomy, coherent subject, readable background'

const DEFAULT_REPLICATE_MODEL = 'black-forest-labs/flux-schnell'

const IMAGE_PROMPT_SYSTEM =
  'Rewrite the user image request into one concise English prompt for an image model. Preserve the core request exactly: subject, action, scene, camera angle, mood, clothing, colors, and composition when they are explicitly stated. Translate Estonian or mixed-language requests into natural English. Do not add unrelated objects, story details, or style changes that were not requested. If something is vague, keep it simple instead of inventing extra content. Return only the final English prompt, no quotes, no labels, no markdown.'

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

type RuntimeImageProviderId = 'automatic1111' | 'comfyui' | 'replicate'

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

async function readImageBuffer(imageSource: string, signal?: AbortSignal) {
  const dataUrl = parseDataUrl(imageSource)

  if (dataUrl) {
    return dataUrl.buffer
  }

  const response = await fetch(imageSource, {
    signal,
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch generated image for upscale: ${response.status}.`)
  }

  return Buffer.from(await response.arrayBuffer())
}

async function upscaleGeneratedImage(
  imageSource: string,
  factor: number,
  signal?: AbortSignal
) {
  if (factor <= 1) {
    return imageSource
  }

  const sourceBuffer = await readImageBuffer(imageSource, signal)
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

function getComfyHeaders() {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (process.env.COMFYUI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.COMFYUI_API_KEY}`
  }

  return headers
}

function getNumericEnv(name: string, fallback: number) {
  const value = process.env[name]

  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function buildWorkflow(
  prompt: string,
  pipeline: ReturnType<typeof getImagePipeline>
) {
  const checkpoint = process.env.COMFYUI_CHECKPOINT_NAME

  if (!checkpoint) {
    throw new Error('COMFYUI_CHECKPOINT_NAME is missing.')
  }

  const width = getNumericEnv('COMFYUI_WIDTH', pipeline.comfy.width)
  const height = getNumericEnv('COMFYUI_HEIGHT', pipeline.comfy.height)
  const steps = getNumericEnv('COMFYUI_STEPS', pipeline.comfy.steps)
  const cfg = getNumericEnv('COMFYUI_CFG', pipeline.comfy.cfg)
  const samplerName = process.env.COMFYUI_SAMPLER || pipeline.comfy.sampler
  const scheduler = process.env.COMFYUI_SCHEDULER || pipeline.comfy.scheduler
  const negativePrompt =
    process.env.COMFYUI_NEGATIVE_PROMPT || DEFAULT_NEGATIVE_PROMPT

  return {
    '3': {
      inputs: {
        seed: Math.floor(Math.random() * 1_000_000_000),
        steps,
        cfg,
        sampler_name: samplerName,
        scheduler,
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
      class_type: 'KSampler',
    },
    '4': {
      inputs: {
        ckpt_name: checkpoint,
      },
      class_type: 'CheckpointLoaderSimple',
    },
    '5': {
      inputs: {
        width,
        height,
        batch_size: 1,
      },
      class_type: 'EmptyLatentImage',
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
        text: negativePrompt,
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
  pipeline: ReturnType<typeof getImagePipeline>
) {
  return `${prompt}, ${DEFAULT_IMAGE_STYLE_PROMPT}, ${pipeline.promptStyle}`
}

async function optimizeImagePrompt(
  prompt: string,
  signal: AbortSignal,
  pipeline: ReturnType<typeof getImagePipeline>,
  enhancePrompt: boolean
) {
  const cleanedPrompt = prompt.trim()

  if (!cleanedPrompt) {
    return cleanedPrompt
  }

  if (!enhancePrompt) {
    return buildFallbackImagePrompt(cleanedPrompt, pipeline)
  }

  if (!process.env.GROQ_API_KEY) {
    return buildFallbackImagePrompt(cleanedPrompt, pipeline)
  }

  try {
    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: IMAGE_PROMPT_SYSTEM,
      prompt: cleanedPrompt,
      abortSignal: signal,
      temperature: 0.2,
    })

    const optimizedPrompt = result.text.trim().replace(/^"|"$/g, '')

    if (!optimizedPrompt) {
      return buildFallbackImagePrompt(cleanedPrompt, pipeline)
    }

    return `${optimizedPrompt}, ${DEFAULT_IMAGE_STYLE_PROMPT}, ${pipeline.promptStyle}`
  } catch {
    return buildFallbackImagePrompt(cleanedPrompt, pipeline)
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
    headers: process.env.COMFYUI_API_KEY
      ? { Authorization: `Bearer ${process.env.COMFYUI_API_KEY}` }
      : undefined,
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
    headers: getComfyHeaders(),
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
    headers: getComfyHeaders(),
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
  pipeline: ReturnType<typeof getImagePipeline>
) {
  const baseUrl = process.env.COMFYUI_BASE_URL?.replace(/\/$/, '')

  if (!baseUrl) {
    return null
  }

  let workflow: Record<string, unknown>

  try {
    workflow = buildWorkflow(prompt.trim(), pipeline)
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to build ComfyUI workflow.'
    )
  }

  const clientId = crypto.randomUUID()
  const promptResponse = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: getComfyHeaders(),
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

async function createAutomatic1111Image(
  prompt: string,
  signal: AbortSignal,
  pipeline: ReturnType<typeof getImagePipeline>
) {
  const baseUrl = process.env.AUTOMATIC1111_BASE_URL?.replace(/\/$/, '')

  if (!baseUrl) {
    return null
  }

  const response = await fetch(`${baseUrl}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      negative_prompt: process.env.AUTOMATIC1111_NEGATIVE_PROMPT || DEFAULT_NEGATIVE_PROMPT,
      width: getNumericEnv('AUTOMATIC1111_WIDTH', pipeline.comfy.width),
      height: getNumericEnv('AUTOMATIC1111_HEIGHT', pipeline.comfy.height),
      steps: getNumericEnv('AUTOMATIC1111_STEPS', pipeline.comfy.steps),
      cfg_scale: getNumericEnv('AUTOMATIC1111_CFG', pipeline.comfy.cfg),
      sampler_name: process.env.AUTOMATIC1111_SAMPLER || pipeline.comfy.sampler,
      batch_size: 1,
      n_iter: 1,
      send_images: true,
      save_images: false,
    }),
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
  pipeline: ReturnType<typeof getImagePipeline>
) {
  const token = process.env.REPLICATE_API_TOKEN

  if (!token) {
    return null
  }

  const model = process.env.REPLICATE_MODEL || DEFAULT_REPLICATE_MODEL
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
            process.env.REPLICATE_ASPECT_RATIO || pipeline.replicate.aspectRatio,
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
      if (Array.isArray(output) && output[0]) return output[0]
      if (typeof output === 'string') return output
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
  const body = await req.json()
  const {
    action,
    prompt,
    providerId,
    pipelineId,
    enhancePrompt,
    imageDataUrl,
  }: {
    action?: 'generate' | 'upscale'
    prompt?: string
    providerId?: string
    pipelineId?: string
    enhancePrompt?: boolean
    imageDataUrl?: string
  } = body

  if (action === 'upscale') {
    if (!imageDataUrl) {
      return new Response(JSON.stringify({ error: 'imageDataUrl is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
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

  if (!prompt?.trim()) {
    return new Response(JSON.stringify({ error: 'Prompt is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const selectedProvider = getImageProvider(providerId)
    const selectedPipeline = getImagePipeline(pipelineId)
    const shouldEnhance = enhancePrompt !== false
    const trimmedPrompt = prompt.trim()
    const optimizedPrompt = await optimizeImagePrompt(
      trimmedPrompt,
      req.signal,
      selectedPipeline,
      shouldEnhance
    )
    const hasAutomatic1111 = Boolean(process.env.AUTOMATIC1111_BASE_URL)
    const hasComfy = Boolean(process.env.COMFYUI_BASE_URL)
    const hasReplicate = Boolean(process.env.REPLICATE_API_TOKEN)

    let imageDataUrl: string | null = null
    let lastError: Error | null = null
    let resolvedProviderId: RuntimeImageProviderId | null = null
    const providerOrder: RuntimeImageProviderId[] =
      selectedProvider.id === 'auto'
        ? ['automatic1111', 'comfyui', 'replicate']
        : [selectedProvider.id as RuntimeImageProviderId]

    for (const candidateProvider of providerOrder) {
      const isConfigured =
        (candidateProvider === 'automatic1111' && hasAutomatic1111) ||
        (candidateProvider === 'comfyui' && hasComfy) ||
        (candidateProvider === 'replicate' && hasReplicate)

      if (!isConfigured) {
        continue
      }

      try {
        if (candidateProvider === 'automatic1111') {
          imageDataUrl = await createAutomatic1111Image(
            optimizedPrompt,
            createBackendSignal(req.signal, 90000),
            selectedPipeline
          )
          resolvedProviderId = 'automatic1111'
          break
        }

        if (candidateProvider === 'comfyui') {
          const queuedJob = await queueComfyUIImage(
            optimizedPrompt,
            createBackendSignal(req.signal, 15000),
            selectedPipeline
          )

          if (!queuedJob) {
            throw new Error('ComfyUI is not configured.')
          }

          return new Response(
            JSON.stringify({
              status: 'queued',
              promptId: queuedJob.promptId,
              shouldUpscale: shouldEnhance,
              provider: 'comfyui',
            }),
            {
              status: 202,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        }

        imageDataUrl = await createReplicateImage(
          optimizedPrompt,
          createBackendSignal(req.signal, 90000),
          selectedPipeline
        )
        resolvedProviderId = 'replicate'
        break
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error(`${candidateProvider} image generation failed.`)
      }
    }

    if (!imageDataUrl && !lastError) {
      lastError = new Error('No image backend is configured for the selected provider.')
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
        shouldUpscale: shouldEnhance,
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