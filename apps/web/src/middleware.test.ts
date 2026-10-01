import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { middleware } from "./middleware"

const origin = "https://forexflow.example.com"
const fetchMock = vi.fn<typeof fetch>()

function authStatus(hasPin: boolean, isAuthenticated: boolean) {
  fetchMock.mockResolvedValue(Response.json({ ok: true, data: { hasPin, isAuthenticated } }))
}

beforeEach(() => {
  vi.stubEnv("VERCEL", "1")
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("hosted authentication", () => {
  it("uses the incoming domain and forwards both app and deployment-protection cookies", async () => {
    authStatus(true, true)
    const cookie = "fxflow_session=session-token; _vercel_jwt=deployment-cookie"
    const response = await middleware(new NextRequest(`${origin}/`, { headers: { cookie } }))

    expect(fetchMock).toHaveBeenCalledWith(
      `${origin}/api/auth/status`,
      expect.objectContaining({ headers: { cookie }, cache: "no-store" }),
    )
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("keeps loopback authentication for self-hosted tunnel requests", async () => {
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("PORT", "3456")
    authStatus(true, true)
    await middleware(new NextRequest(`${origin}/`))

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3456/api/auth/status",
      expect.any(Object),
    )
  })

  it("leaves the auth status endpoint public to avoid recursive checks", async () => {
    const response = await middleware(new NextRequest(`${origin}/api/auth/status`))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("redirects a fresh database to PIN setup", async () => {
    authStatus(false, false)
    const response = await middleware(new NextRequest(`${origin}/`))
    expect(response.headers.get("location")).toBe(`${origin}/setup`)
  })

  it("allows PIN setup on a fresh database", async () => {
    authStatus(false, false)
    const response = await middleware(new NextRequest(`${origin}/setup`))
    expect(response.headers.get("x-middleware-next")).toBe("1")
  })

  it("redirects unauthenticated visitors while preserving their destination", async () => {
    authStatus(true, false)
    const response = await middleware(new NextRequest(`${origin}/positions`))
    expect(response.headers.get("location")).toBe(`${origin}/login?redirect=%2Fpositions`)
  })

  it("prevents PIN setup from being reopened after initialization", async () => {
    authStatus(true, true)
    const response = await middleware(new NextRequest(`${origin}/setup`))
    expect(response.headers.get("location")).toBe(`${origin}/`)
  })

  it("returns 503 instead of exposing a trading API when the auth check fails", async () => {
    fetchMock.mockRejectedValue(new Error("Database offline"))
    const response = await middleware(new NextRequest(`${origin}/api/trades`))
    expect(response.status).toBe(503)
    expect(response.headers.get("x-middleware-next")).toBeNull()
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  it("does not create login redirect loops when the auth endpoint returns an error", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: false }, { status: 500 }))
    const response = await middleware(new NextRequest(`${origin}/login`))
    expect(response.status).toBe(503)
    expect(response.headers.get("location")).toBeNull()
  })

  it("rejects invalid auth responses", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }))
    const response = await middleware(new NextRequest(`${origin}/`))
    expect(response.status).toBe(503)
  })
})
