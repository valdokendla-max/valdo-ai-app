export interface KnowledgeItem {
  id: string
  title: string
  content: string
  category: 'juhis' | 'naidis' | 'fakt' | 'stiil'
  createdAt: string
}

class KnowledgeStore {
  private items: Map<string, KnowledgeItem> = new Map()

  constructor() {
    this.seed()
  }

  private seed() {
    this.add({
      title: 'Valdo isiksusjuhis',
      content: 'Sa oled Valdo AI. Sa oled alati abivalmis, sober ja aus. Sa suhtled loomulikult ja vabalt.',
      category: 'juhis',
    })
  }

  getAll(): KnowledgeItem[] {
    return Array.from(this.items.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  getByCategory(category: KnowledgeItem['category']): KnowledgeItem[] {
    return this.getAll().filter((item) => item.category === category)
  }

  getContext(): string {
    const items = this.getAll()
    if (items.length === 0) return ''

    const sections: string[] = []

    const juhised = items.filter((i) => i.category === 'juhis')
    if (juhised.length > 0) {
      sections.push('## Juhised:\n' + juhised.map((i) => `- ${i.title}: ${i.content}`).join('\n'))
    }

    const naidised = items.filter((i) => i.category === 'naidis')
    if (naidised.length > 0) {
      sections.push('## Naidised:\n' + naidised.map((i) => `### ${i.title}\n${i.content}`).join('\n\n'))
    }

    const faktid = items.filter((i) => i.category === 'fakt')
    if (faktid.length > 0) {
      sections.push('## Faktid:\n' + faktid.map((i) => `- ${i.title}: ${i.content}`).join('\n'))
    }

    const stiil = items.filter((i) => i.category === 'stiil')
    if (stiil.length > 0) {
      sections.push('## Stiilinjuhised:\n' + stiil.map((i) => `- ${i.title}: ${i.content}`).join('\n'))
    }

    return '\n\n--- TEADMISTEBAAS ---\n' + sections.join('\n\n')
  }

  add(input: Omit<KnowledgeItem, 'id' | 'createdAt'>): KnowledgeItem {
    const id = crypto.randomUUID()
    const item: KnowledgeItem = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    }
    this.items.set(id, item)
    return item
  }

  remove(id: string): boolean {
    return this.items.delete(id)
  }
}

export const knowledgeStore = new KnowledgeStore()
