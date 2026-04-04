import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const PUBLIC_HOST = 'valdo-ai-webapp.vercel.app'
const PROTECTED_HOSTS = new Set([
  'valdo-ai-webapp-valdos-projects-48d5db42.vercel.app',
  'valdo-ai-webapp-git-main-valdos-projects-48d5db42.vercel.app',
])

export function proxy(request: NextRequest) {
  const host = request.headers.get('host')

  if (!host || !PROTECTED_HOSTS.has(host)) {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const redirectUrl = new URL(request.url)
  redirectUrl.host = PUBLIC_HOST
  redirectUrl.protocol = 'https:'

  return NextResponse.redirect(redirectUrl, 307)
}

export const config = {
  matcher: '/:path*',
}