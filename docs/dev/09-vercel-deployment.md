---
title: "Vercel Deployment"
description: "Host the Next.js web app on Vercel with an external daemon and Turso database."
category: "dev"
order: 9
---

# Vercel Deployment

Deploy `apps/web` as a single Next.js project. The `site` directory is the
marketing/documentation website; `apps/daemons` is the persistent trading process.
Deploying the web app alone does not start the daemon or initialize the database.

## Prerequisites

- A Turso database with the ForexFlow schema initialized.
- A running daemon with a public HTTPS/WebSocket endpoint. See
  [Cloud Deployment](08-cloud-deployment.md) for the daemon hosting configuration.
- The same `DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `ENCRYPTION_KEY` on the web app
  and daemon. `ENCRYPTION_KEY` must be a 64-character hexadecimal string.

Use a persistent cloud database rather than a local `file:` SQLite database on
Vercel. Do not commit `.env.local` files or API credentials to GitHub.

## Import the web app

1. Import your GitHub repository in Vercel.
2. If Vercel detects multiple applications, select **Import single project** on
   the **web / Next.js** row rather than importing the entire repository as Services.
3. Set **Root Directory** to `apps/web` and **Framework Preset** to **Next.js**.
4. Enable **Include source files outside of the Root Directory in the Build Step**.
5. Select Node.js **22.x**.

`apps/web/vercel.json` installs dependencies from the monorepo root using pnpm
and builds only the web app. The root install script generates the Prisma client;
it does not initialize or migrate your cloud database. Leave Output Directory at
the Next.js default.

## Environment variables

Add these variables in Vercel before deploying. Use Production and, if you want
working preview deployments, Preview environments. Prefer a separate database
and daemon for previews.

| Variable                 | Value                                                        |
| ------------------------ | ------------------------------------------------------------ |
| `DATABASE_URL`           | Your Turso URL, such as `libsql://fxflow-example.turso.io`   |
| `TURSO_AUTH_TOKEN`       | The database authentication token                            |
| `ENCRYPTION_KEY`         | The same 64-character hex key used by the daemon             |
| `DAEMON_REST_URL`        | The daemon's HTTPS URL, such as `https://daemon.example.com` |
| `NEXT_PUBLIC_DAEMON_URL` | Its WebSocket URL, such as `wss://daemon.example.com`        |

These URLs are examples: replace them with real endpoints, without a trailing
slash. `DAEMON_REST_URL` is server-only. The browser uses the authenticated
same-origin Next.js REST proxies and connects directly to the configured daemon
WebSocket URL. Vercel does not run the custom `server.ts` WebSocket proxy.

`NEXT_PUBLIC_DAEMON_REST_URL` is an optional fallback for the server URL.
`NEXT_PUBLIC_CLOUD_DAEMON_URL` is the existing alternative that connects browser
REST and WebSocket traffic directly to the cloud daemon. If you use that mode,
configure `ALLOWED_ORIGINS` on the daemon to include your web app's origin.

The web app reads Vercel's environment directly. A repo-root `.env.local` remains
supported for local development, and its values do not override supplied
environment variables. Do not create `apps/web/.env.local`.

To generate a new encryption key locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If you already have encrypted credentials in the database, reuse their current
key rather than generating a different one.

## Deploy and verify

1. Click **Deploy** after adding the environment variables.
2. Open the deployment URL. A fresh database should redirect to `/setup` to
   create your PIN; an initialized database should require login.
3. Confirm the daemon connects and that Settings shows its health status.
4. Connect your broker through Settings once the database and daemon are ready.

Authentication on Vercel uses the incoming deployment domain and forwards cookies,
including Vercel deployment-protection cookies. Self-hosted installations continue
using localhost for the internal auth check. If the auth endpoint cannot be reached
or the database is unavailable, protected requests return HTTP 503.

Redeploy after changing environment variables, especially `NEXT_PUBLIC_*` values,
which Next.js embeds at build time.
