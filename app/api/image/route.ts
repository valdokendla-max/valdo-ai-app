export const maxDuration = 60

const DEFAULT_NEGATIVE_PROMPT =
  'low quality, blurry, distorted, deformed, bad anatomy, extra fingers, watermark, text'

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

  const width = Number(process.env.COMFYUI_WIDTH || 1024)
  const height = Number(process.env.COMFYUI_HEIGHT || 1024)
  const steps = Number(process.env.COMFYUI_STEPS || 30)
  const cfg = Number(process.env.COMFYUI_CFG || 4)
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

export async function POST(req: Request) {
  const { prompt }: { prompt?: string } = await req.json()

  if (!prompt?.trim()) {
    return new Response(JSON.stringify({ error: 'Prompt is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const baseUrl = process.env.COMFYUI_BASE_URL?.replace(/\/$/, '')

  if (!baseUrl) {
    return new Response(
      JSON.stringify({
        error:
          'COMFYUI_BASE_URL is missing. Add your ComfyUI server URL to environment variables.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  let workflow: Record<string, unknown>

  try {
    workflow = buildWorkflow(prompt.trim())
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to build workflow.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const clientId = crypto.randomUUID()
  const promptResponse = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: getComfyHeaders(),
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    signal: req.signal,
  })

  if (!promptResponse.ok) {
    const error = await promptResponse.text()
    return new Response(JSON.stringify({ error }), {
      status: promptResponse.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const promptData = (await promptResponse.json()) as { prompt_id?: string }

  if (!promptData.prompt_id) {
    return new Response(JSON.stringify({ error: 'ComfyUI did not return a prompt_id.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let image: ComfyImage | null = null

  for (let attempt = 0; attempt < 50; attempt++) {
    await sleep(1000)

    const historyResponse = await fetch(`${baseUrl}/history/${promptData.prompt_id}`, {
      headers: getComfyHeaders(),
      signal: req.signal,
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
    return new Response(
      JSON.stringify({
        error: 'Image generation timed out before ComfyUI returned an image.',
      }),
      {
        status: 504,
        headers: { 'Content-Type': 'application/json' },
      }
    )
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
    signal: req.signal,
    cache: 'no-store',
  })

  if (!imageResponse.ok) {
    const error = await imageResponse.text()
    return new Response(JSON.stringify({ error }), {
      status: imageResponse.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const contentType = imageResponse.headers.get('content-type') || 'image/png'
  const buffer = Buffer.from(await imageResponse.arrayBuffer())
  const imageDataUrl = `data:${contentType};base64,${buffer.toString('base64')}`

  return new Response(JSON.stringify({ imageDataUrl }), {
    headers: { 'Content-Type': 'application/json' },
  })
}