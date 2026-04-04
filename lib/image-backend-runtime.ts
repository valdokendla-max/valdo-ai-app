export type RuntimeImageProviderId = 'automatic1111' | 'comfyui' | 'replicate'

type BackendRuntimeState = {
  score: number
  consecutiveFailures: number
  cooldownUntil: number
  lastFailureAt: number | null
  lastSuccessAt: number | null
  lastError: string | null
}

const INITIAL_SCORE = 100
const FAILURE_PENALTY = 25
const SUCCESS_RECOVERY = 8
const FAILURE_THRESHOLD = 2
const DEFAULT_COOLDOWN_MS = 120_000

const backendRuntimeState: Record<RuntimeImageProviderId, BackendRuntimeState> = {
  automatic1111: {
    score: INITIAL_SCORE,
    consecutiveFailures: 0,
    cooldownUntil: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastError: null,
  },
  comfyui: {
    score: INITIAL_SCORE,
    consecutiveFailures: 0,
    cooldownUntil: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastError: null,
  },
  replicate: {
    score: INITIAL_SCORE,
    consecutiveFailures: 0,
    cooldownUntil: 0,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastError: null,
  },
}

function getCooldownMs() {
  const parsed = Number(process.env.IMAGE_BACKEND_COOLDOWN_MS || DEFAULT_COOLDOWN_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_COOLDOWN_MS
}

function now() {
  return Date.now()
}

export function getBackendRuntimeSnapshot(providerId: RuntimeImageProviderId) {
  const state = backendRuntimeState[providerId]
  const currentTime = now()
  const cooldownRemainingMs = Math.max(0, state.cooldownUntil - currentTime)

  return {
    ...state,
    coolingDown: cooldownRemainingMs > 0,
    cooldownRemainingMs,
  }
}

export function isBackendCoolingDown(providerId: RuntimeImageProviderId) {
  return getBackendRuntimeSnapshot(providerId).coolingDown
}

export function recordBackendSuccess(providerId: RuntimeImageProviderId) {
  const state = backendRuntimeState[providerId]
  state.score = Math.min(INITIAL_SCORE, state.score + SUCCESS_RECOVERY)
  state.consecutiveFailures = 0
  state.cooldownUntil = 0
  state.lastSuccessAt = now()
  state.lastError = null
}

export function recordBackendFailure(providerId: RuntimeImageProviderId, error: string) {
  const state = backendRuntimeState[providerId]
  state.score = Math.max(0, state.score - FAILURE_PENALTY)
  state.consecutiveFailures += 1
  state.lastFailureAt = now()
  state.lastError = error

  if (state.consecutiveFailures >= FAILURE_THRESHOLD) {
    const multiplier = state.consecutiveFailures - FAILURE_THRESHOLD + 1
    state.cooldownUntil = now() + getCooldownMs() * multiplier
  }
}

export function sortProvidersForAuto(providerIds: RuntimeImageProviderId[]) {
  return [...providerIds]
    .map((providerId, index) => ({
      providerId,
      index,
      runtime: getBackendRuntimeSnapshot(providerId),
    }))
    .sort((left, right) => {
      if (left.runtime.coolingDown !== right.runtime.coolingDown) {
        return left.runtime.coolingDown ? 1 : -1
      }

      if (left.runtime.score !== right.runtime.score) {
        return right.runtime.score - left.runtime.score
      }

      return left.index - right.index
    })
    .map((entry) => entry.providerId)
}