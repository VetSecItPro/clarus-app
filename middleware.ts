import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createMiddlewareClient } from "@/lib/supabase-middleware"

// Routes that don't need auth session refresh
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/callback",
  "/terms",
  "/privacy",
  "/pricing",
  "/discover",
]

const PUBLIC_PREFIXES = [
  "/share/",
  "/features/",
  "/api/polar/webhook",
  "/api/assemblyai-webhook",
  "/api/crons/",
  "/api/discover",
]

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

export async function middleware(request: NextRequest) {
  const origin = request.headers.get("origin")
  const pathname = request.nextUrl.pathname

  // Skip static files and _next
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Handle API routes with CORS
  if (pathname.startsWith("/api/")) {
    // Handle preflight requests (OPTIONS)
    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 204 })
      setCorsHeaders(response, origin)
      setSecurityHeaders(response)
      return response
    }

    // Skip auth for public API routes (webhooks, crons)
    if (isPublicRoute(pathname)) {
      const response = NextResponse.next()
      setCorsHeaders(response, origin)
      setSecurityHeaders(response)
      return response
    }

    // Refresh session for authenticated API routes
    const { supabase, response } = createMiddlewareClient(request)
    await supabase.auth.getSession()

    setCorsHeaders(response, origin)
    setSecurityHeaders(response)
    return response
  }

  // Skip auth for public pages (landing, login, share, etc.)
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next()
    setSecurityHeaders(response)
    return response
  }

  // For authenticated routes, refresh the session to keep users logged in
  const { supabase, response } = createMiddlewareClient(request)
  await supabase.auth.getSession()

  return response
}

function setCorsHeaders(response: NextResponse, origin: string | null) {
  // Allow Chrome extension origins and the main site
  const allowedOrigins = [
    "https://clarusapp.io",
    "https://clarusapp.io",
    "http://localhost:3000", // Development
    "http://localhost:3456", // Clarus dev port
  ]

  // Check if origin is a Chrome extension or in allowed list
  const isAllowed =
    origin &&
    (origin.startsWith("chrome-extension://") || allowedOrigins.includes(origin))

  if (isAllowed && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
    response.headers.set("Access-Control-Max-Age", "86400") // 24 hours
  }
}

function setSecurityHeaders(response: NextResponse) {
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY")

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")

  // XSS protection (legacy, but still useful for older browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block")

  // Referrer policy - don't leak URLs to third parties
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions policy - restrict powerful features
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  )

  // Content Security Policy
  // Note: 'unsafe-inline' needed for Next.js inline styles
  // 'unsafe-eval' needed for some Next.js development features
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.youtube.com https://s.ytimg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: http:",
      "media-src 'self' https://www.youtube.com",
      "frame-src 'self' https://www.youtube.com https://youtube.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openrouter.ai https://api.tavily.com https://api.firecrawl.dev https://api.supadata.ai https://api.resend.com https://api.polar.sh https://api.assemblyai.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ")
  )

  // HSTS - enforce HTTPS (only in production)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    )
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
