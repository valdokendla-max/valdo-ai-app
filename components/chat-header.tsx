'use client'

import { Bot, RotateCcw, BookOpen } from 'lucide-react'

interface ChatHeaderProps {
  hasMessages: boolean
  onReset: () => void
  onOpenKnowledge: () => void
}

export function ChatHeader({ hasMessages, onReset, onOpenKnowledge }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-4 py-3 sticky top-0 z-10">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground leading-none">Valdo AI</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Privaatne assistent</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenKnowledge}
          className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/80"
        >
          <BookOpen className="h-3 w-3" />
          Teadmised
        </button>
        {hasMessages && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/80"
          >
            <RotateCcw className="h-3 w-3" />
            Uus vestlus
          </button>
        )}
      </div>
    </header>
  )
}
