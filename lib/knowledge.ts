export const KNOWLEDGE_CATEGORIES = ['juhis', 'naidis', 'fakt', 'stiil'] as const

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number]

export interface KnowledgeItem {
  id: string
  title: string
  content: string
  category: KnowledgeCategory
  createdAt: string
}

export const KNOWLEDGE_ADMIN_HEADER = 'x-knowledge-admin-token'
export const KNOWLEDGE_ADMIN_STORAGE_KEY = 'valdo-ai-knowledge-admin-token'