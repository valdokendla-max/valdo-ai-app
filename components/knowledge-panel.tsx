'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, Plus, BookOpen, Lightbulb, FileText, Palette, Trash2, ArrowLeft } from 'lucide-react'
import { resolveClientApiPath } from '@/lib/chat-client'
import {
  KNOWLEDGE_ADMIN_HEADER,
  KNOWLEDGE_ADMIN_STORAGE_KEY,
  type KnowledgeCategory,
  type KnowledgeItem,
} from '@/lib/knowledge'

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
  const [category, setCategory] = useState<KnowledgeCategory>('juhis')
  const [isLoading, setIsLoading] = useState(false)
  const [adminToken, setAdminToken] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const dialogTitleId = 'knowledge-panel-title'
  const dialogDescriptionId = 'knowledge-panel-description'
  const titleInputId = 'knowledge-item-title'
  const contentInputId = 'knowledge-item-content'

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    setAdminToken(window.localStorage.getItem(KNOWLEDGE_ADMIN_STORAGE_KEY) || '')
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (adminToken.trim()) {
      window.localStorage.setItem(KNOWLEDGE_ADMIN_STORAGE_KEY, adminToken.trim())
      return
    }

    window.localStorage.removeItem(KNOWLEDGE_ADMIN_STORAGE_KEY)
  }, [adminToken])

  const getKnowledgeHeaders = useCallback((includeJsonContentType = false) => {
    const headers = new Headers()

    if (includeJsonContentType) {
      headers.set('Content-Type', 'application/json')
    }

    if (adminToken.trim()) {
      headers.set(KNOWLEDGE_ADMIN_HEADER, adminToken.trim())
    }

    return headers
  }, [adminToken])

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(resolveClientApiPath('/api/knowledge'), {
        headers: getKnowledgeHeaders(),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Teadmistebaasi laadimine ebaõnnestus.')
      }

      setItems(data)
      setStatusMessage(null)
    } catch (error) {
      setItems([])
      setStatusMessage(
        error instanceof Error ? error.message : 'Teadmistebaasi laadimine ebaõnnestus.'
      )
    }
  }, [getKnowledgeHeaders])

  useEffect(() => {
    if (!isOpen || !adminToken.trim()) {
      return
    }

    void fetchItems()
  }, [adminToken, fetchItems, isOpen])

  const handleAdd = async () => {
    if (!title.trim() || !content.trim()) return
    setIsLoading(true)

    try {
      const response = await fetch(resolveClientApiPath('/api/knowledge'), {
        method: 'POST',
        headers: getKnowledgeHeaders(true),
        body: JSON.stringify({ title, content, category }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Teadmistebaasi salvestamine ebaõnnestus.')
      }

      setTitle('')
      setContent('')
      setIsAdding(false)
      setStatusMessage(null)
      await fetchItems()
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Teadmistebaasi salvestamine ebaõnnestus.'
      )
    }

    setIsLoading(false)
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${resolveClientApiPath('/api/knowledge')}?id=${id}`, {
        method: 'DELETE',
        headers: getKnowledgeHeaders(),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Teadmistebaasi kirje kustutamine ebaõnnestus.')
      }

      setStatusMessage(null)
      await fetchItems()
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Teadmistebaasi kirje kustutamine ebaõnnestus.'
      )
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

        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="knowledge-admin-token" className="text-xs font-medium text-foreground">
              Teadmistebaasi admin token
            </label>
            <div className="flex gap-2">
              <input
                id="knowledge-admin-token"
                name="knowledge-admin-token"
                type="password"
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                placeholder="KNOWLEDGE_ADMIN_TOKEN"
                className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => void fetchItems()}
                disabled={!adminToken.trim()}
                className="rounded-lg bg-secondary px-3 py-2 text-xs text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
              >
                Ava
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ilma tokenita ei saa teadmistebaasi vaadata ega muuta.
            </p>
            {statusMessage ? <p className="text-xs text-destructive">{statusMessage}</p> : null}
          </div>
        </div>

        {/* Add Form */}
        {isAdding && adminToken.trim() && (
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
          {!adminToken.trim() ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Sisesta admin token</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Alles siis saab teadmistebaasi turvaliselt avada ja muuta.
              </p>
            </div>
          ) : items.length === 0 ? (
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
