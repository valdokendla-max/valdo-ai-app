import { groq } from '@ai-sdk/groq'
import { convertToModelMessages, streamText, UIMessage } from 'ai'
import { getPromptProfile, getTextModel } from '@/lib/ai-hub'
import { getChatArtifactFormat, getChatOutputMode } from '@/lib/chat-output'
import { knowledgeStore } from '@/lib/knowledge-store'
import { chatRequestSchema } from '@/lib/server/api-schemas'
import {
  createValidationErrorResponse,
  parseJsonBody,
} from '@/lib/server/request-validation'

export const maxDuration = 60

const BASE_SYSTEM = `Sa oled Valdo AI, privaatne AI hubi assistent.
Sa suhtled nii eesti kui inglise keeles vastavalt kasutaja keelele.
Sa oled otsekohene, abivalmis ja praktiline.
Kui kasutaja kirjutab eesti keeles, vasta eesti keeles. Kui inglise keeles, vasta inglise keeles.
Kui vastus vajab eeldusi või piiranguid, too need lühidalt välja.
Kui kasutaja palub luua allalaetava faili, genereeri lisaks tavalisele vastusele artifact-blokk täpselt selles formaadis:
<artifact name="failinimi.ext" mime="mime/type">
FAILI SISU SIIN
</artifact>
Kasuta artifact-blokke ainult siis, kui kasutaja tahab päriselt faili alla laadida.
Kui kasutaja tahab mitut faili või ZIP-i, loo iga faili jaoks eraldi artifact-blokk. UI pakib need automaatselt ZIP-iks.
Hoia artifact-bloki sees ainult faili sisu, ilma lisaselgituste ja markdownita.
Tekstifailide, koodifailide, HTML-i, SVG, JSON-i, CSV ja MD jaoks eelista artifact-blokke.
Fotorealistliku PNG või JPG puhul kasuta pildigeneratsiooni režiimi, mitte ära teeskle binaarfaili tekstina.`

function buildOutputInstructions(outputModeId?: string, artifactFormatId?: string) {
  const outputMode = getChatOutputMode(outputModeId)
  const artifactFormat = getChatArtifactFormat(artifactFormatId)

  if (outputMode.id === 'chat') {
    return 'Käitu tavavestlusena. Kasuta artifact-blokke ainult siis, kui kasutaja seda otseselt palub.'
  }

  const formatInstruction =
    artifactFormat.id === 'auto'
      ? 'Vali ise kõige sobivam failivorming vastavalt kasutaja soovile.'
      : `Kasuta väljundina vormingut ${artifactFormat.label}, faililaiendit ${artifactFormat.extension} ja MIME tüüpi ${artifactFormat.mime}.`

  const richDocumentInstruction =
    artifactFormat.id === 'pdf' || artifactFormat.id === 'docx'
      ? 'PDF ja DOCX puhul pane artifact-bloki sisse puhas tekstiline või markdown-laadne sisu. UI koostab sellest allalaetava dokumendi.'
      : ''

  if (outputMode.id === 'file') {
    return `${formatInstruction} Loo vähemalt üks artifact-blokk isegi siis, kui kasutaja ei maini sõna fail. Anna enne faili lühike 1-2 lauseline selgitus. ${richDocumentInstruction}`.trim()
  }

  return `${formatInstruction} Loo vähemalt kaks omavahel seotud artifact-blokki, et kasutaja saaks need ZIP-ina alla laadida. Kui ülesanne annaks tavaliselt ühe faili, jaga tulemus mõistlikeks osadeks. ${richDocumentInstruction}`.trim()
}

export async function POST(req: Request) {
  let payload: {
    messages: UIMessage[]
    modelId?: string
    promptProfileId?: string
    outputMode?: string
    artifactFormat?: string
  }

  try {
    payload = await parseJsonBody(req, chatRequestSchema, {
      maxBytes: 512 * 1024,
      emptyBodyMessage: 'Chat body puudub.',
    })
  } catch (error) {
    return createValidationErrorResponse(error, 'Chat parsimine ebaõnnestus.')
  }

  const { messages, modelId, promptProfileId, outputMode, artifactFormat } = payload

  if (!process.env.GROQ_API_KEY) {
    return new Response(
      JSON.stringify({
        error: 'GROQ_API_KEY is missing. Add it to your environment variables.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const knowledgeContext = await knowledgeStore.getContext()
  const selectedModel = getTextModel(modelId)
  const selectedProfile = getPromptProfile(promptProfileId)
  const outputInstructions = buildOutputInstructions(outputMode, artifactFormat)
  const system = `${BASE_SYSTEM}\n${selectedProfile.systemSuffix}\n${outputInstructions}${knowledgeContext}`
  const result = streamText({
    model: groq(selectedModel.model),
    system,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse()
}
