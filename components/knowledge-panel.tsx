'use client'

import { useState, useEffect } from 'react'
import { X, Plus, BookOpen, Lightbulb, FileText, Palette, Trash2, ArrowLeft } from 'lucide-react'

interface KnowledgeItem {
  id: string
  title: string
  content: string
  category: 'juhis' | 'naidis' | 'fakt' | 'stiil'
  createdAt: string
}

const CATEGORY_CONFIG = {
  juhis: { label: 'Juhis', icon: BookOpen, description: 'Kaitumisjuhised ja reeglid' },
  naidis: { label: 'Naidis', icon: FileText, description: 'Naidistekstid ja -vastused' },
  fakt: { label: 'Fakt', icon: Lightbulb, description: 'Faktid ja teadmised' },
  stiil: { label: 'Stiil', icon: Palette, description: 'Kirjutamise stiil ja toon' },
} as const

interface KnowledgePanelProps {
  isOpen: boolean
  onClose: () => void
}

export function KnowledgePanel({ isOpen, onClose }: KnowledgePanelProps) {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<KnowledgeItem['category']>('juhis')
  const [isLoading, setIsLoading] = useState(false)
  const dialogTitleId = 'knowledge-panel-title'
  const dialogDescriptionId = 'knowledge-panel-description'
  const titleInputId = 'knowledge-item-title'
  const contentInputId = 'knowledge-item-content'

  const fetchItems = async () => {
    try {
      const res = await fetch('/api/knowledge')
      const data = await res.json()
      setItems(data)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (isOpen && items.length === 0) {
      (async () => {
        try {
          const res = await fetch('/api/knowledge');
          const data = await res.json();
          setItems(data);
        } catch {
          /* ignore */
        }
      })();
    }
  }, [isOpen, items.length]);

  const handleAdd = async () => {
    if (!title.trim() || !content.trim()) return
    setIsLoading(true)
    try {
      await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category }),
      })
      setTitle('')
      setContent('')
      setIsAdding(false)
      await fetchItems()
    } catch {
      /* ignore */
    }
    setIsLoading(false)
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/knowledge?id=${id}`, { method: 'DELETE' })
      await fetchItems()
    } catch {
      /* ignore */
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        className="relative ml-auto flex h-full w-full max-w-lg flex-col bg-card border-l border-border shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Sulge teadmistebaas"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 id={dialogTitleId} className="text-sm font-semibold text-foreground">Teadmistebaas</h2>
              <p id={dialogDescriptionId} className="text-xs text-muted-foreground">{items.length} kirjet</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-3 w-3" />
              Lisa
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Sulge teadmistebaas"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Add Form */}
        {isAdding && (
          <div className="border-b border-border p-5">
            <div className="flex flex-col gap-3">
              <input
                id={titleInputId}
                name={titleInputId}
                type="text"
                placeholder="Pealkiri..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map((key) => {
                  const config = CATEGORY_CONFIG[key]
                  const Icon = config.icon
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setCategory(key)}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                        category === key
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </button>
                  )
                })}
              </div>
              <textarea
                id={contentInputId}
                name={contentInputId}
                aria-describedby={dialogDescriptionId}
                placeholder="Sisu... (nt. juhised, naidistekst, faktid)"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setTitle(''); setContent('') }}
                  className="rounded-lg bg-secondary px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Tuhista
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!title.trim() || !content.trim() || isLoading}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isLoading ? 'Salvestamine...' : 'Salvesta'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Teadmistebaas on tuhi</p>
              <p className="mt-1 text-xs text-muted-foreground">Lisa juhiseid, naidiseid ja fakte, et Valdo sind paremini teenindaks.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map((item) => {
                const config = CATEGORY_CONFIG[item.category]
                const Icon = config.icon
                return (
                  <div key={item.id} className="group rounded-xl border border-border bg-secondary/40 p-4 transition-colors hover:bg-secondary/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-3 w-3" />
                        </div>
                        <div>
                          <span className="text-xs font-medium text-foreground">{item.title}</span>
                          <span className="ml-2 text-[10px] text-muted-foreground">{config.label}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        aria-label={`Kustuta kirje ${item.title}`}
                        className="rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">{item.content}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
