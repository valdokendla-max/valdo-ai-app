'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Logi viga vajadusel
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-4">Midagi läks valesti</h1>
      <p className="text-lg text-muted-foreground mb-8">Tekkis ootamatu viga. Palun proovi uuesti.</p>
      <button onClick={reset} className="text-primary underline">Proovi uuesti</button>
    </div>
  )
}
