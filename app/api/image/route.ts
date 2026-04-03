export const maxDuration = 300

const DEFAULT_NEGATIVE_PROMPT =
  'low quality, blurry, distorted, deformed, bad anatomy, extra fingers, watermark, text'

const DEFAULT_REPLICATE_MODEL = 'black-forest-labs/flux-schnell'

type ComfyImage = {
  filename: string
  subfolder?: string
  type?: string
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

function buildWorkflow(prompt: string) {
  const checkpoint = process.env.COMFYUI_CHECKPOINT_NAME

  if (!checkpoint) {
    throw new Error('COMFYUI_CHECKPOINT_NAME is missing.')
  }

  const width = Number(process.env.COMFYUI_WIDTH || 384)
  const height = Number(process.env.COMFYUI_HEIGHT || 384)
  const steps = Number(process.env.COMFYUI_STEPS || 4)
  const cfg = Number(process.env.COMFYUI_CFG || 2.5)
  const samplerName = process.env.COMFYUI_SAMPLER || 'euler'
  const scheduler = process.env.COMFYUI_SCHEDULER || 'normal'
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

async function createReplicateImage(prompt: string, signal: AbortSignal) {
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
          aspect_ratio: process.env.REPLICATE_ASPECT_RATIO || '1:1',
          output_format: process.env.REPLICATE_OUTPUT_FORMAT || 'png',
          output_quality: Number(process.env.REPLICATE_OUTPUT_QUALITY || 100),
          num_outputs: 1,
        },
      }),
      signal,
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Replicate error: ${error}`)
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
      throw new Error(`Replicate polling failed: ${error}`)
    }

    prediction = await pollResponse.json()
  }

  throw new Error('Replicate image generation timed out.')
}

async function createComfyUIImage(prompt: string, signal: AbortSignal) {
  const baseUrl = process.env.COMFYUI_BASE_URL?.replace(/\/$/, '')

  if (!baseUrl) {
    return null
  }

  let workflow: Record<string, unknown>

  try {
    workflow = buildWorkflow(prompt.trim())
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

  let image: ComfyImage | null = null

  for (let attempt = 0; attempt < 180; attempt++) {
    await sleep(1000)

    const historyResponse = await fetch(`${baseUrl}/history/${promptData.prompt_id}`, {
      headers: getComfyHeaders(),
      signal,
      cache: 'no-store',
    })

    if (!historyResponse.ok) {
      continue
    }

    const history = await historyResponse.json()
    const historyEntry = history?.[promptData.prompt_id]
    image = getFirstImage(historyEntry)

    if (image) {
      break
    }
  }

  if (!image) {
    throw new Error('Image generation timed out before ComfyUI returned an image.')
  }

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

export async function POST(req: Request) {
  const { prompt }: { prompt?: string } = await req.json()

  if (!prompt?.trim()) {
    return new Response(JSON.stringify({ error: 'Prompt is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let imageDataUrl: string | null = null
    let lastError: Error | null = null

    try {
      imageDataUrl = await createReplicateImage(prompt.trim(), req.signal)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Replicate image generation failed.')
    }

    if (!imageDataUrl) {
      try {
        imageDataUrl = await createComfyUIImage(prompt.trim(), req.signal)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('ComfyUI image generation failed.')
      }
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

    return new Response(JSON.stringify({ imageDataUrl }), {
      headers: { 'Content-Type': 'application/json' },
    })
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