'use client'

import { Bot, Shield, Zap } from 'lucide-react'

interface ChatWelcomeProps {
  onSuggestionClick: (text: string) => void
}

const suggestions = [
  'Selgita mulle kvantarvutuse pohimotteid',
  'Loo pilt noorest naisest punases kleidis uduses männimetsas kuuvalguses, cinematic, realistic',
  'Kirjuta Python skript failide sorteerimiseks',
  'Loo pilt mustast kassist aknal vihmase ilmaga, close-up, soft light',
]

export function ChatWelcome({ onSuggestionClick }: ChatWelcomeProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6">
        <Bot className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground mb-2 text-balance text-center">
        Tere tulemast, Valdo AI Hub
      </h1>
      <p className="text-muted-foreground text-sm mb-8 max-w-md text-center text-pretty">
        Sinu privaatne tekstide, piltide ja prompt pipeline'ide töölaud. Kuidas saan sind aidata?
      </p>

      <div className="flex items-center gap-6 mb-8 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" />
          <span>Privaatne</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span>Mitme reziimiga</span>
        </div>
      </div>

      <div className="mb-8 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card/80 p-4 text-left">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Tekst</p>
          <h2 className="mt-2 text-sm font-semibold text-foreground">Mudeli valik</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Llama 3.3 70B ja Llama 3.1 8B koos prompti profiilidega.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-4 text-left">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Pilt</p>
          <h2 className="mt-2 text-sm font-semibold text-foreground">Backendid</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            ComfyUI ja Replicate on AI hubis olemas.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card/80 p-4 text-left">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Prompt</p>
          <h2 className="mt-2 text-sm font-semibold text-foreground">Parema pildi valem</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Subjekt + koht + valgus + stiil annab parema tulemuse kui üksik sõna.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 w-full max-w-lg">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary hover:border-primary/30"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  )
}
