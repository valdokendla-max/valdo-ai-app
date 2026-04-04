import { groq } from '@ai-sdk/groq'
import { convertToModelMessages, streamText, UIMessage } from 'ai'
import { getPromptProfile, getTextModel } from '@/lib/ai-hub'
import { knowledgeStore } from '@/lib/knowledge-store'

export const maxDuration = 60

const BASE_SYSTEM = `Sa oled Valdo AI, privaatne AI hubi assistent.
Sa suhtled nii eesti kui inglise keeles vastavalt kasutaja keelele.
Sa oled otsekohene, abivalmis ja praktiline.
Kui kasutaja kirjutab eesti keeles, vasta eesti keeles. Kui inglise keeles, vasta inglise keeles.
Kui vastus vajab eeldusi või piiranguid, too need lühidalt välja.`

export async function POST(req: Request) {
  const {
    messages,
    modelId,
    promptProfileId,
  }: {
    messages: UIMessage[]
    modelId?: string
    promptProfileId?: string
  } = await req.json()

  if (!process.env.GROQ_API_KEY) {
    return new Response(
      JSON.stringify({
        error: 'GROQ_API_KEY is missing. Add it to your environment variables.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const knowledgeContext = knowledgeStore.getContext()
  const selectedModel = getTextModel(modelId)
  const selectedProfile = getPromptProfile(promptProfileId)
  const system = `${BASE_SYSTEM}\n${selectedProfile.systemSuffix}${knowledgeContext}`
  const result = streamText({
    model: groq(selectedModel.model),
    system,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse()
}
