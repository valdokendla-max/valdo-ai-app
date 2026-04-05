'use client'

import { Bot, BookOpen, Plus } from 'lucide-react'

interface ChatHeaderProps {
  conversations: Array<{
    id: string
    title: string
    updatedAt: string
  }>
  activeConversationId: string
  onSelectConversation: (conversationId: string) => void
  onNewConversation: () => void
  onOpenKnowledge: () => void
}

export function ChatHeader({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onOpenKnowledge,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-4 py-3 sticky top-0 z-10">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground leading-none">Valdo AI Hub</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Tekst, pildid ja pipeline&apos;id</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden min-w-[220px] md:block">
          <label className="sr-only" htmlFor="conversation-select">
            Vali vestlus
          </label>
          <select
            id="conversation-select"
            value={activeConversationId}
            onChange={(event) => onSelectConversation(event.target.value)}
            className="w-full rounded-lg border border-border/70 bg-card/60 px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {conversations
              .slice()
              .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
              .map((conversation, index) => (
                <option key={conversation.id} value={conversation.id}>
                  {index + 1}. {conversation.title}
                </option>
              ))}
          </select>
        </div>
        <button
          onClick={onOpenKnowledge}
          className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/80"
        >
          <BookOpen className="h-3 w-3" />
          Teadmised
        </button>
        <button
          onClick={onNewConversation}
          className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary/80"
        >
          <Plus className="h-3 w-3" />
          Uus vestlus
        </button>
      </div>
    </header>
  )
}
