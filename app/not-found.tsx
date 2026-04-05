import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-4">404 - Lehte ei leitud</h1>
      <p className="text-lg text-muted-foreground mb-8">Otsitud lehte ei eksisteeri.</p>
      <Link href="/" className="text-primary underline">
        Tagasi avalehele
      </Link>
    </div>
  )
}