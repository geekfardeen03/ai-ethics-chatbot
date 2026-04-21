# AI Ethics Chatbot

An AI-powered conversational advisor for ethical AI questions — covering bias, fairness, privacy, transparency, and governance across domains like healthcare, finance, HR, legal, and education.

Built with **React + Vite** (frontend) and **Node.js + Express** (backend), powered by the **Anthropic Claude API**.

---

## Features

- **Domain detection** — automatically detects and tracks context (healthcare, finance, HR, legal, education)
- **Intent detection** — identifies the ethical focus (bias, fairness, privacy, transparency, governance)
- **Topic shift awareness** — detects when you change subjects and acknowledges it naturally
- **Explainability layer** — every response includes a "Why this answer" section
- **References** — cites relevant laws and frameworks (HIPAA, GDPR, EU AI Act, EEOC, etc.)
- **Suggested follow-ups** — clickable next questions after each response
- **Full conversation memory** — context is maintained across the entire session
- **Rate limiting** — backend protects against excessive API usage

---

## Project Structure

```
ai-ethics-chatbot/
├── backend/
│   ├── server.js          # Express server + Anthropic API + domain/intent logic
│   ├── package.json
│   └── .env.example       # Environment variable template
└── frontend/
    ├── index.html
    ├── vite.config.js     # Dev proxy: /api → localhost:3001
    ├── package.json
    └── src/
        ├── App.jsx                  # Root layout (sidebar + chat)
        ├── App.module.css
        ├── index.css                # Global design tokens
        ├── main.jsx
        ├── utils/
        │   └── api.js               # fetch() wrappers for backend
        ├── hooks/
        │   └── useChat.js           # Chat state, history, domain/intent tracking
        └── components/
            ├── DomainBar.jsx/.css   # Live domain chips header
            ├── Message.jsx/.css     # Bot/user message bubbles
            ├── ChatInput.jsx/.css   # Textarea + starter prompts
            └── TypingIndicator.jsx  # Animated loading dots
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- An Anthropic API key → [console.anthropic.com](https://console.anthropic.com)

---

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
PORT=3001
FRONTEND_URL=http://localhost:5173
```

Start the backend:
```bash
npm run dev       # development (with nodemon auto-reload)
# or
npm start         # production
```

Backend runs at: `http://localhost:3001`
Health check: `http://localhost:3001/api/health`

---

### 2. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

The Vite dev server proxies all `/api/*` requests to `localhost:3001` — no CORS setup needed.

---

## API Reference

### POST `/api/chat`

Send a chat message and get an ethics-aware response.

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "How can AI be biased in hiring?" }
  ],
  "currentDomain": "general",
  "currentIntent": "general"
}
```

**Response:**
```json
{
  "answer": "AI hiring tools can perpetuate bias when...",
  "intent": "bias",
  "domain": "hr",
  "explanation": "This answer draws on EEOC disparate impact doctrine...",
  "confidence": "high",
  "references": ["EEOC Guidelines", "Uniform Guidelines on Employee Selection Procedures"],
  "suggestions": ["What is disparate impact?", "How do I audit my hiring algorithm?"],
  "detectedDomain": "hr",
  "detectedIntent": "bias",
  "domainChanged": false,
  "intentChanged": false
}
```

### GET `/api/health`

```json
{ "status": "ok", "timestamp": "2025-04-19T..." }
```

---

## Environment Variables

| Variable        | Description                          | Default                    |
|-----------------|--------------------------------------|----------------------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key           | *(required)*               |
| `PORT`          | Backend server port                  | `3001`                     |
| `FRONTEND_URL`  | Allowed CORS origin                  | `http://localhost:5173`    |

---

## Deployment

### Deploy backend to Railway / Render / Fly.io

1. Push `backend/` to a Git repo
2. Set environment variables (`ANTHROPIC_API_KEY`, `FRONTEND_URL`)
3. Set start command: `node server.js`

### Deploy frontend to Vercel / Netlify

1. Push `frontend/` to a Git repo
2. Build command: `npm run build`
3. Output directory: `dist`
4. Set environment variable (if needed):
   - If your backend is deployed, update `vite.config.js` proxy target OR replace `/api` base URL in `src/utils/api.js` with your deployed backend URL

### Production tip

In production, replace the Vite proxy with an absolute backend URL. In `src/utils/api.js`:
```js
const API_BASE = import.meta.env.VITE_API_URL || "/api";
```
Then set `VITE_API_URL=https://your-backend.railway.app` in your frontend environment.

---

## Customization

### Adding a new domain
In `backend/server.js`, add to the `DOMAINS` object:
```js
retail: ["ecommerce","product recommendation","customer","purchase","shopping","recommendation engine"]
```

### Adding a new intent
In `backend/server.js`, add to the `INTENTS` object:
```js
sustainability: ["carbon","environment","green ai","energy","sustainable","climate"]
```

### Changing the AI model
In `backend/server.js`, update the model string:
```js
model: "claude-opus-4-20250514"  // more powerful
model: "claude-haiku-4-5-20251001"  // faster / cheaper
```

---

## Tech Stack

| Layer     | Technology                    |
|-----------|-------------------------------|
| Frontend  | React 18, Vite, CSS Modules   |
| Backend   | Node.js, Express              |
| AI        | Anthropic Claude (Sonnet 4)   |
| Rate limiting | express-rate-limit        |
| Dev proxy | Vite built-in proxy           |

---

## License

MIT
