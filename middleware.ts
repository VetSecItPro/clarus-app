import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// CORS middleware for Chrome extension support
// Chrome extensions have origin format: chrome-extension://[extension-id]

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin")

  // Only process API routes
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Handle preflight requests (OPTIONS)
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 })
    setCorsHeaders(response, origin)
    return response
  }

  // Add CORS headers to response
  const response = NextResponse.next()
  setCorsHeaders(response, origin)
  return response
}

function setCorsHeaders(response: NextResponse, origin: string | null) {
  // Allow Chrome extension origins and the main site
  const allowedOrigins = [
    "https://infosecops.io",
    "http://localhost:3000", // Development
  ]

  // Check if origin is a Chrome extension or in allowed list
  const isAllowed =
    origin &&
    (origin.startsWith("chrome-extension://") || allowedOrigins.includes(origin))

  if (isAllowed && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Credentials", "true")
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
    response.headers.set("Access-Control-Max-Age", "86400") // 24 hours
  }
}

export const config = {
  matcher: "/api/:path*",
}
