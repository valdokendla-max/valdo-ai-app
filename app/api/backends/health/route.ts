type BackendHealthState = 'connected' | 'configured' | 'missing' | 'error'

type BackendHealthEntry = {
  status: BackendHealthState
  detail: string
}

function toDisplayHost(value: string) {
  try {
    const url = new URL(value)
    return url.host
  } catch {
    return value
  }
}

function describeHttpStatus(status: number) {
  if (status === 401 || status === 403) {
    return `Autentimine ebaõnnestus (HTTP ${status})`
  }

  if (status >= 500) {
    return `Backend vastas veaga (HTTP ${status})`
  }

  return `Backend vastas ootamatult (HTTP ${status})`
}

function getErrorDetail(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Vastus puudub'
  }

  const cause = error.cause

  if (typeof cause === 'object' && cause !== null) {
    if ('code' in cause && typeof cause.code === 'string') {
      return `${error.message} (${cause.code})`
    }

    if ('message' in cause && typeof cause.message === 'string') {
      return `${error.message} (${cause.message})`
    }
  }

  return error.message || 'Vastus puudub'
}

async function checkComfyUI(): Promise<BackendHealthEntry> {
  const baseUrl = process.env.COMFYUI_BASE_URL?.replace(/\/$/, '')

  if (!baseUrl) {
    return {
      status: 'missing',
      detail: 'COMFYUI_BASE_URL puudub',
    }
  }

  const host = toDisplayHost(baseUrl)

  try {
    const response = await fetch(`${baseUrl}/system_stats`, {
      headers: process.env.COMFYUI_API_KEY
        ? { Authorization: `Bearer ${process.env.COMFYUI_API_KEY}` }
        : undefined,
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        status: 'error',
        detail: `${host}: ${describeHttpStatus(response.status)}`,
      }
    }

    return {
      status: 'connected',
      detail: `${host}: uhendus olemas`,
    }
  } catch (error) {
    return {
      status: 'error',
      detail: `${host}: ${getErrorDetail(error)}`,
    }
  }
}

async function checkAutomatic1111(): Promise<BackendHealthEntry> {
  const baseUrl = process.env.AUTOMATIC1111_BASE_URL?.replace(/\/$/, '')

  if (!baseUrl) {
    return {
      status: 'missing',
      detail: 'AUTOMATIC1111_BASE_URL puudub',
    }
  }

  const host = toDisplayHost(baseUrl)

  try {
    const response = await fetch(`${baseUrl}/sdapi/v1/options`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        status: 'error',
        detail: `${host}: ${describeHttpStatus(response.status)}`,
      }
    }

    return {
      status: 'connected',
      detail: `${host}: uhendus olemas`,
    }
  } catch (error) {
    return {
      status: 'error',
      detail: `${host}: ${getErrorDetail(error)}`,
    }
  }
}

function checkReplicate(): BackendHealthEntry {
  if (!process.env.REPLICATE_API_TOKEN) {
    return {
      status: 'missing',
      detail: 'REPLICATE_API_TOKEN puudub',
    }
  }

  const model = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell'

  return {
    status: 'configured',
    detail: `Token olemas, mudel ${model}`,
  }
}

export async function GET() {
  const automatic1111 = await checkAutomatic1111()
  const comfyui = await checkComfyUI()

  return Response.json({
    automatic1111,
    comfyui,
    replicate: checkReplicate(),
  })
}