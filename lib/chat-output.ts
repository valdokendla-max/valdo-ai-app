export type ChatOutputModeId = 'chat' | 'file' | 'zip'

export type ChatArtifactFormatId =
  | 'auto'
  | 'txt'
  | 'md'
  | 'json'
  | 'html'
  | 'csv'
  | 'svg'
  | 'pdf'
  | 'docx'

export const CHAT_OUTPUT_MODES = [
  {
    id: 'chat' as const,
    label: 'Vestlus',
    description: 'Tavaline tekstivastus ilma kohustusliku failita',
  },
  {
    id: 'file' as const,
    label: 'Fail',
    description: 'Lase mudelil luua üks allalaetav fail',
  },
  {
    id: 'zip' as const,
    label: 'ZIP',
    description: 'Lase mudelil luua mitu seotud faili',
  },
] as const

export const CHAT_ARTIFACT_FORMATS = [
  { id: 'auto' as const, label: 'Automaatne', extension: '', mime: '' },
  { id: 'txt' as const, label: 'TXT', extension: '.txt', mime: 'text/plain' },
  { id: 'md' as const, label: 'Markdown', extension: '.md', mime: 'text/markdown' },
  { id: 'json' as const, label: 'JSON', extension: '.json', mime: 'application/json' },
  { id: 'html' as const, label: 'HTML', extension: '.html', mime: 'text/html' },
  { id: 'csv' as const, label: 'CSV', extension: '.csv', mime: 'text/csv' },
  { id: 'svg' as const, label: 'SVG', extension: '.svg', mime: 'image/svg+xml' },
  { id: 'pdf' as const, label: 'PDF', extension: '.pdf', mime: 'application/pdf' },
  {
    id: 'docx' as const,
    label: 'DOCX',
    extension: '.docx',
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
] as const

export const DEFAULT_CHAT_OUTPUT_MODE: ChatOutputModeId = 'chat'
export const DEFAULT_CHAT_ARTIFACT_FORMAT: ChatArtifactFormatId = 'auto'

export function getChatOutputMode(outputModeId?: string) {
  return CHAT_OUTPUT_MODES.find((mode) => mode.id === outputModeId) ?? CHAT_OUTPUT_MODES[0]
}

export function getChatArtifactFormat(formatId?: string) {
  return (
    CHAT_ARTIFACT_FORMATS.find((format) => format.id === formatId) ?? CHAT_ARTIFACT_FORMATS[0]
  )
}