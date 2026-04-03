'use client'

import { useRef, useEffect } from 'react'
import { ArrowUp, ImagePlus, Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  onSubmit: () => void
  isLoading: boolean
  error?: string
  isImageMode: boolean
  onToggleImageMode: () => void
}

export function ChatInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  error,
  isImageMode,
  onToggleImageMode,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return
    onSubmit()
  }

  return (
    <div className="border-t border-border bg-background px-4 py-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            onClick={onToggleImageMode}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors',
              isImageMode
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
            )}
            type="button"
          >
            {isImageMode ? <MessageSquare className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
            {isImageMode ? 'Tekstireziim' : 'Loo pilt'}
          </button>
          <p className="text-xs text-muted-foreground">
            {isImageMode ? 'Saadan prompti pildigeneraatorile' : 'Saadan prompti tekstimudelile'}
          </p>
        </div>
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder={isImageMode ? 'Kirjelda pilti, mida soovid luua...' : 'Kirjuta siia...'}
            rows={1}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
              input.trim() && !isLoading
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'bg-secondary text-muted-foreground'
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-center text-xs text-red-400">
            {error}
          </p>
        ) : (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {isImageMode
              ? 'Pildid tulevad ComfyUI kaudu sinu enda backendist'
              : 'Valdo AI - Sinu privaatne assistent'}
          </p>
        )}
      </div>
    </div>
  )
}
