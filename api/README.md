# NeoPass API - Cloudflare Workers + Hono

Backend API for NeoPass Chrome Extension, built with [Hono](https://hono.dev) on Cloudflare Workers.

## Project Structure

```
api/
├── src/
│   ├── index.ts           # Main entry point
│   ├── types.ts           # TypeScript types & interfaces
│   ├── middleware/
│   │   └── auth.ts        # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.ts        # /api/auth endpoints
│   │   └── account.ts     # /api/account endpoints
│   └── utils/
│       ├── jwt.ts         # JWT sign/verify (Web Crypto API)
│       └── password.ts    # Password hashing (SHA-256)
├── wrangler.toml          # Cloudflare Workers config
├── package.json
└── tsconfig.json
```

## API Endpoints

| Method | Path                  | Auth   | Description                         |
| ------ | --------------------- | ------ | ----------------------------------- |
| GET    | `/`                   | No     | Health check                        |
| POST   | `/api/auth`           | No     | Login (username + password)         |
| POST   | `/api/auth/register`  | No     | Register new user                   |
| GET    | `/api/account`        | Bearer | Get account info                    |
| GET    | `/api/account/status` | Bearer | Quick Pro status check              |
| POST   | `/api/ai/solve`       | Bearer | AI solve (MCQ, coding, chat, nptel) |
| POST   | `/api/ai/chat`        | Bearer | AI chat with conversation history   |
| GET    | `/api/ai/models`      | No     | List available AI models            |

## AI Endpoints (Cloudflare Workers AI - Free Tier)

All AI requests use **Cloudflare Workers AI** — no external API keys needed. Rate limited to 50 requests/hour per user.

### POST /api/ai/solve

```json
{
  "prompt": "What is 2 + 2?",
  "type": "mcq" // mcq | coding | chat | nptel | solve
}
```

**Task types and their models:**

| Type     | Model                                          | Use Case                             |
| -------- | ---------------------------------------------- | ------------------------------------ |
| `mcq`    | `@cf/mistralai/mistral-small-3.1-24b-instruct` | Multiple choice questions            |
| `nptel`  | `@cf/mistralai/mistral-small-3.1-24b-instruct` | NPTEL assignment questions           |
| `coding` | `@cf/moonshotai/kimi-k2.7-code`                | Advanced code generation & debugging |
| `chat`   | `@cf/mistralai/mistral-small-3.1-24b-instruct` | General conversation                 |
| `solve`  | `@cf/mistralai/mistral-small-3.1-24b-instruct` | General problem solving              |

### POST /api/ai/chat

```json
{
  "messages": [
    { "role": "user", "content": "Help me solve this coding problem" },
    { "role": "assistant", "content": "Sure, what's the problem?" },
    { "role": "user", "content": "Write a function to reverse a string" }
  ]
}
```

### GET /api/ai/models

Returns all available models with their task types.

## Setup

### 1. Install dependencies

```bash
cd api
npm install
```

### 2. Create KV Namespace

```bash
wrangler kv:namespace create "USERS"
```

Copy the returned `id` and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "USERS"
id = "your-kv-namespace-id"
```

### 3. Set secrets

```bash
wrangler secret put JWT_SECRET
# Enter a strong random string (e.g., openssl rand -base64 32)
```

### 4. Local development

```bash
npm run dev
```

### 5. Deploy

```bash
npm run deploy
```

## Seeding Users

You can seed initial users via the register endpoint or by writing directly to KV:

```bash
# Via API
curl -X POST https://api.neopass.tech/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123"}'

# Via wrangler (direct KV write)
wrangler kv:key put --binding USERS "user:admin" '{"username":"admin","passwordHash":"...","isPro":true,"plan":"pro","createdAt":1700000000000}'
```

## Updating Extension API URL

If you change the deployment URL, update these files in the extension:

- `popup.js` — `API_BASE_URL`
- `worker.js` — `API_BASE_URL`
- `data/inject/screenshare.js` — `NP_API_BASE`

## Notes

- Passwords are hashed with SHA-256 via Web Crypto API. For production, consider upgrading to a proper KDF like Argon2 via a Worker-compatible library.
- JWT tokens expire after 12 hours (matches the extension's `SESSION_DURATION`).
- All CORS origins are allowed (`*`) since the extension makes cross-origin requests. Tighten this if you add a web frontend.
