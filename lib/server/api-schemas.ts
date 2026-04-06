import { z } from 'zod'
import { KNOWLEDGE_CATEGORIES } from '@/lib/knowledge'

const MAX_IMAGE_DATA_URL_LENGTH = 28 * 1024 * 1024

const textMessagePartSchema = z
  .object({
    type: z.literal('text'),
    text: z.string().min(1).max(20_000),
  })
  .strict()

const chatMessageSchema = z
  .object({
    id: z.string().min(1).max(200),
    role: z.enum(['system', 'user', 'assistant']),
    parts: z.array(textMessagePartSchema).min(1).max(32),
  })
  .strict()

export const chatRequestSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(40),
    modelId: z.string().max(64).optional(),
    promptProfileId: z.string().max(64).optional(),
    outputMode: z.string().max(32).optional(),
    artifactFormat: z.string().max(32).optional(),
  })
  .strict()

export const imageRequestSchema = z
  .object({
    action: z.enum(['generate', 'upscale']).optional(),
    prompt: z.string().trim().min(1).max(4_000).optional(),
    providerId: z.string().max(64).optional(),
    pipelineId: z.string().max(64).optional(),
    aspectRatioId: z.string().max(64).optional(),
    stylePresetId: z.string().max(64).optional(),
    seed: z.number().int().min(0).max(2_147_483_647).nullable().optional(),
    variationStrength: z.number().min(0).max(100).optional(),
    enhancePrompt: z.boolean().optional(),
    adultOnly: z.boolean().optional(),
    safetyModeId: z.enum(['strict', 'balanced']).optional(),
    imageDataUrl: z.string().max(MAX_IMAGE_DATA_URL_LENGTH).optional(),
    referenceImageDataUrl: z.string().max(MAX_IMAGE_DATA_URL_LENGTH).optional(),
    imageToImageStrength: z.number().min(0).max(100).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === 'upscale') {
      if (!value.imageDataUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['imageDataUrl'],
          message: 'imageDataUrl on kohustuslik upscale jaoks.',
        })
      }

      return
    }

    if (!value.prompt?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['prompt'],
        message: 'prompt on kohustuslik.',
      })
    }
  })

export const knowledgeCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    content: z.string().trim().min(1).max(12_000),
    category: z.enum(KNOWLEDGE_CATEGORIES),
  })
  .strict()
