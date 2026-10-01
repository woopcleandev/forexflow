import { NextResponse, type NextRequest } from "next/server"

/** Paths that skip the auth check entirely (static assets, API auth). */
const STATIC_PUBLIC_PATHS = [
  "/api/auth/",
  "/_next/",
  "/favicon.ico",
  "/manifest.json",
  "/sw.js",
  "/icons/",
  "/offline.html",
  "/apple-icon.png",
  "/icon.png",
  "/logo-white.png",
  "/logo-black.png",
]

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // Skip auth for static/API paths only
  if (STATIC_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Self-hosted installs use loopback to avoid tunnel round trips. On Vercel,
  // use the incoming origin and forward cookies for deployment protection.
  const port = process.env.PORT ?? "3000"
  const baseUrl = process.env.VERCEL === "1" ? request.nextUrl.origin : `http://localhost:${port}`
  try {
    const res = await fetch(`${baseUrl}/api/auth/status`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      return authUnavailable()
    }

    const json = (await res.json()) as {
      ok: boolean
      data?: { hasPin: boolean; isAuthenticated: boolean }
    }

    if (!json.ok || !json.data) {
      return authUnavailable()
    }

    // No PIN set → only allow /setup
    if (!json.data.hasPin) {
      if (pathname !== "/setup") {
        return NextResponse.redirect(new URL("/setup", request.url))
      }
      return NextResponse.next()
    }

    // PIN exists → block /setup (prevent PIN reset via URL)
    if (pathname === "/setup") {
      return NextResponse.redirect(new URL("/", request.url))
    }

    // PIN set but not authenticated → allow /login, redirect everything else
    if (!json.data.isAuthenticated) {
      if (pathname !== "/login") {
        const loginUrl = new URL("/login", request.url)
        if (pathname !== "/") {
          loginUrl.searchParams.set("redirect", pathname)
        }
        return NextResponse.redirect(loginUrl)
      }
      return NextResponse.next()
    }

    // Authenticated → don't let them visit login
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url))
    }

    return NextResponse.next()
  } catch {
    // A failed auth check must not expose protected pages or API routes.
    return authUnavailable()
  }
}

function authUnavailable(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Authentication temporarily unavailable. Please try again." },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "5" } },
  )
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.png$|.*\\.svg$).*)",
  ],
}
