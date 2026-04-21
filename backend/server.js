require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Groq = require("groq-sdk");
const { detectDomainML, detectIntentML } = require("./mlModel");


const app = express();
const PORT = process.env.PORT || 3001;

// ── Groq client ───────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many requests, please slow down." },
});
app.use("/api/", limiter);

// ── Domain & Intent keywords ──────────────────────────────────────────────────
const DOMAINS = {
  healthcare: ["patient","hospital","medical","diagnosis","clinical","doctor","nurse","ehr","drug","treatment","health","radiology","imaging","surgery","therapy","pharma","fda","telemedicine","ai doctor","mental health"],
  finance: ["loan","credit","bank","fraud","investment","trading","insurance","mortgage","fintech","risk","portfolio","aml","kyc","stock","interest","payment","financial","algorithmic trading","credit score"],
  hr: ["hiring","recruit","resume","candidate","employee","hr","workforce","interview","promotion","salary","performance","diversity","talent","job","applicant","onboarding","termination"],
  legal: ["court","judge","sentencing","criminal","legal","law","attorney","compliance","gdpr","regulation","lawsuit","contract","ccpa","rights","due process","warrant","recidivism","predictive policing"],
  education: ["student","school","grade","exam","university","teacher","learning","curriculum","admission","academic","edtech","classroom","assessment","plagiarism","tutoring","grading"],
};

const INTENTS = {
  bias: ["bias","biased","discriminat","unfair","prejudice","stereotype","skew","inequit","disparity","marginalize","underrepresent"],
  fairness: ["fair","equit","equal","impartial","just","balance","neutral","objective","representative","inclusive","diverse"],
  privacy: ["privacy","data","personal","gdpr","consent","surveillance","track","collect","share","secure","breach","confidential","anonymize","pii","sensitive"],
  transparency: ["transparent","explain","interpretab","black box","xai","audit","trace","understand","reason","justify","accountab","openness","disclosure"],
  governance: ["govern","regulat","policy","compliance","law","legal","framework","standard","guideline","oversight","control","enforce","responsible ai"],
};

// improved version: score-based matching instead of first keyword hit

function detectDomain(text) {
  if (!text || typeof text !== "string") return "general";

  const input = text.toLowerCase();
  let bestDomain = "general";
  let maxScore = 0;

  for (const domain in DOMAINS) {
    let score = 0;

    for (const keyword of DOMAINS[domain]) {
      if (input.includes(keyword)) {
        score++;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestDomain = domain;
    }
  }

  // small safeguard: avoid false positives
  if (maxScore === 0) return "general";

  return bestDomain;
}


function detectIntent(text) {
  if (!text || typeof text !== "string") return "general";

  const input = text.toLowerCase();
  let bestIntent = "general";
  let maxScore = 0;

  for (const intent in INTENTS) {
    let score = 0;

    for (const keyword of INTENTS[intent]) {
      if (input.includes(keyword)) {
        score++;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent;
    }
  }

  if (maxScore === 0) return "general";

  return bestIntent;
}

// ── System prompt builder ─────────────────────────────────────────────────────
function buildSystemPrompt(currentDomain, currentIntent, previousDomain, previousIntent) {
  const domainChanged =
    previousDomain &&
    currentDomain !== "general" &&
    currentDomain !== previousDomain;

  const intentChanged =
    previousIntent &&
    currentIntent !== "general" &&
    currentIntent !== previousIntent;

  // small helper for domain-specific hints
  function getDomainHint(domain) {
    switch (domain) {
      case "healthcare":
        return "Use HIPAA and clinical safety considerations.";
      case "finance":
        return "Reference fairness in credit scoring and financial regulations.";
      case "hr":
        return "Consider hiring bias and EEOC guidelines.";
      case "legal":
        return "Focus on due process and legal accountability.";
      case "education":
        return "Include fairness in grading and student data privacy.";
      default:
        return "Use general AI ethics frameworks.";
    }
  }

  return `
You are an AI Ethics Advisor focused on responsible AI.

Context:
- Domain: ${currentDomain}
- Intent: ${currentIntent}
${domainChanged ? `- NOTE: Domain changed from ${previousDomain} to ${currentDomain}. Acknowledge naturally.` : ""}
${intentChanged ? `- NOTE: Intent changed from ${previousIntent} to ${currentIntent}. Adjust reasoning.` : ""}

Instructions:
- Give clear, practical answers (not generic theory)
- Adapt response to the domain context
- Include a short explanation ("why this answer")
- Avoid unnecessary jargon

Domain hint:
${getDomainHint(currentDomain)}

Output format (STRICT JSON ONLY):
{
  "answer": "2-5 sentence response (HTML allowed)",
  "intent": "bias|fairness|privacy|transparency|governance|general",
  "domain": "healthcare|finance|hr|legal|education|general",
  "explanation": "short reasoning behind answer",
  "confidence": "high|medium|low",
  "references": ["law or framework"],
  "suggestions": ["follow-up question 1", "follow-up question 2"]
}
`;
}

// ── Chat endpoint ─────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages, currentDomain = "general", currentIntent = "general" } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required." });
  }

  // resolve domain & intent with fallback to preserve conversation context

// safely extract latest message
const latestMessageObj = messages[messages.length - 1];
const latestMessage = latestMessageObj?.content || "";

// run detection (score-based functions)
let detectedDomain = detectDomain(latestMessage);
let detectedIntent = detectIntent(latestMessage);

// keep previous state
const previousDomain = currentDomain;
const previousIntent = currentIntent;

// resolve domain with fallback
let resolvedDomain = detectedDomain;
if (detectedDomain === "general" && previousDomain !== "general") {
  resolvedDomain = previousDomain;
}

// resolve intent with fallback
let resolvedIntent = detectedIntent;
if (detectedIntent === "general" && previousIntent !== "general") {
  resolvedIntent = previousIntent;
}

// detect meaningful shifts only
const domainChanged =
  resolvedDomain !== "general" &&
  previousDomain !== "general" &&
  resolvedDomain !== previousDomain;

const intentChanged =
  resolvedIntent !== "general" &&
  previousIntent !== "general" &&
  resolvedIntent !== previousIntent;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(resolvedDomain, resolvedIntent, previousDomain, previousIntent),
        },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const rawText = completion.choices[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    } catch {
      parsed = {
        answer: rawText,
        intent: resolvedIntent,
        domain: resolvedDomain,
        explanation: "",
        confidence: "medium",
        references: [],
        suggestions: [],
      };
    }

    return res.json({
      ...parsed,
      detectedDomain: resolvedDomain,
      detectedIntent: resolvedIntent,
      domainChanged,
      intentChanged,
      previousDomain,
      previousIntent,
    });
  } catch (err) {
    console.error("Groq API error:", err.message);
    return res.status(500).json({ error: "Failed to get AI response: " + err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", model: "llama-3.3-70b-versatile (Groq)", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🚀 AI Ethics Chatbot (Groq) running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Chat:   POST http://localhost:${PORT}/api/chat\n`);
});