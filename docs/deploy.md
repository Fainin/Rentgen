# Deploy

Rentgen is a static SPA (Vite) — the whole app builds to `apps/app/dist` and is served
over HTTPS. HTTPS is required: the camera scan (`getUserMedia`) only works on `https://`
or `localhost`, never on `http://<lan-ip>`.

## Vercel (recommended)

The repo ships a `vercel.json` at the root:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "apps/app/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- `npm run build` builds `@rentgen/sdk` (tsup) and then the app (Vite); the app bundles the
  SDK from source via its `exports` map, so no separate publish step is needed.
- The SPA rewrite sends deep links / reloads to `index.html` (static assets are served
  directly by the filesystem first, so they are not affected).

### One-time setup
1. Import the repo in Vercel (or `npx vercel link`). Leave **Root Directory** at the repo root.
2. Add the build-time env vars (Production + Preview):

   | Var | Purpose |
   |---|---|
   | `VITE_OPENAI_API_KEY` | OpenAI vision (detection) |
   | `VITE_TAVILY_API_KEY` | Tavily price comps |
   | `VITE_GEMINI_API_KEY` | optional Gemini detection backend |

   Leave all blank to deploy in **stub/offline mode** (mock data, no keys) — useful for a
   safe public demo without exposing quota.

3. Deploy: push to `main` (Git integration) or `npx vercel deploy --prod`.

### ⚠️ API keys are client-exposed
`VITE_*` vars are inlined into the public browser bundle — anyone can read them. For the
hackathon these are **demo-scoped, rate-limited keys that get rotated/deleted after the
event**. For a permanent public deployment, move the keys behind a serverless proxy so they
stay server-side (tracked as a follow-up — the SDK adapters already isolate the provider
calls, so a `baseUrl` override + `/api/*` proxy functions is a contained change).

## Local

```bash
npm install
cp apps/app/.env.example apps/app/.env   # fill keys, or leave blank for stub mode
npm run dev                              # http://localhost:5173
```

Mobile camera test: deploy to the Vercel preview URL and open it on the phone over HTTPS
(a `http://<laptop-ip>` LAN URL will NOT grant camera access).
