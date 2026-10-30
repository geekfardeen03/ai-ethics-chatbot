```javascript
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Groq = require("groq-sdk");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3001;
const MODEL = "openai/gpt-oss-120b";

// Validate required environment variables
if (!process.env.GROQ_API_KEY) {
  console.error("Missing GROQ_API_KEY environment variable.");
  process.exit(1);
}

if (!process.env.FRONTEND_URL && process.env.NODE_ENV === "production") {
  console.warn("FRONTEND_URL is not configured.");
}

// Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);

app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    error: "Too many requests. Please slow down.",
  },
});

app.use("/api/", limiter);

// Domain keywords
const DOMAINS = {
  healthcare: [
    "patient", "hospital", "medical", "diagnosis", "clinical",
    "doctor", "nurse", "ehr", "drug", "treatment", "health",
    "radiology", "imaging", "surgery", "therapy", "pharma",
    "fda", "telemedicine", "ai doctor", "mental health",
  ],
  finance: [
    "loan", "credit", "bank", "fraud", "investment", "trading",
    "insurance", "mortgage", "fintech", "risk", "portfolio",
    "aml", "kyc", "stock", "interest", "payment", "financial",
    "algorithmic trading", "credit score",
  ],
  hr: [
    "hiring", "recruit", "resume", "candidate", "employee", "hr",
    "workforce", "interview", "promotion", "salary", "performance",
    "diversity", "talent", "job", "applicant", "onboarding",
    "termination",
  ],
  legal: [
    "court", "judge", "sentencing", "criminal", "legal", "law",
    "attorney", "compliance", "gdpr", "regulation", "lawsuit",
    "contract", "ccpa", "rights", "due process", "warrant",
    "recidivism", "predictive policing",
  ],
  education: [
    "student", "school", "grade", "exam", "university", "teacher",
    "learning", "curriculum", "admission", "academic", "edtech",
    "classroom", "assessment", "plagiarism", "tutoring", "grading",
  ],
};

// Intent keywords
const INTENTS = {
  bias: [
    "bias", "biased", "discriminat", "unfair", "prejudice",
    "stereotype", "skew", "inequit", "disparity", "marginalize",
    "underrepresent",
  ],
  fairness: [
    "fair", "equit", "equal", "impartial", "just", "balance",
    "neutral", "objective", "representative", "inclusive",
    "diverse",
  ],
  privacy: [
    "privacy", "data", "personal", "gdpr", "consent",
    "surveillance", "track", "collect", "share", "secure",
    "breach", "confidential", "anonymize", "pii", "sensitive",
  ],
  transparency: [
    "transparent", "explain", "interpretab", "black box", "xai",
    "audit", "trace", "understand", "reason", "justify",
    "accountab", "openness", "disclosure",
  ],
  governance: [
    "govern", "regulat", "policy", "compliance", "law", "legal",
    "framework", "standard", "guideline", "oversight", "control",
    "enforce", "responsible ai",
  ],
};

// Score-based domain detection
function detectDomain(text) {
  if (!text || typeof text !== "string") {
    return "general";
  }

  const input = text.toLowerCase();
  let bestDomain = "general";
  let maxScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAINS)) {
    const score = keywords.filter((keyword) =>
      input.includes(keyword)
    ).length;

    if (score > maxScore) {
      maxScore = score;
      bestDomain = domain;
    }
  }

  return maxScore === 0 ? "general" : bestDomain;
}

// Score-based intent detection
function detectIntent(text) {
  if (!text || typeof text !== "string") {
    return "general";
  }

  const input = text.toLowerCase();
  let bestIntent = "general";
  let maxScore = 0;

  for (const [intent, keywords] of Object.entries(INTENTS)) {
    const score = keywords.filter((keyword) =>
      input.includes(keyword)
    ).length;

    if (score > maxScore) {
      maxScore = score;
      bestIntent = intent;
    }
  }

  return maxScore === 0 ? "general" : bestIntent;
}

// Build the system prompt
function buildSystemPrompt(
  currentDomain,
  currentIntent,
  previousDomain,
  previousIntent
) {
  const domainChanged =
    previousDomain &&
    currentDomain !== "general" &&
    currentDomain !== previousDomain;

  const intentChanged =
    previousIntent &&
    currentIntent !== "general" &&
    currentIntent !== previousIntent;

  function getDomainHint(domain) {
    switch (domain) {
      case "healthcare":
        return "Consider HIPAA and clinical safety.";
      case "finance":
        return "Consider fairness in credit scoring and relevant financial regulations.";
      case "hr":
        return "Consider hiring bias and EEOC guidelines.";
      case "legal":
        return "Focus on due process and legal accountability.";
      case "education":
        return "Consider fairness in grading and student data privacy.";
      default:
        return "Use general AI ethics frameworks.";
    }
  }

  return `
You are an AI Ethics Advisor focused on responsible AI.

Context:
- Domain: ${currentDomain}
- Intent: ${currentIntent}
${domainChanged ? `- Domain changed from ${previousDomain} to ${currentDomain}. Acknowledge naturally.` : ""}
${intentChanged ? `- Intent changed from ${previousIntent} to ${currentIntent}. Adjust your answer.` : ""}

Instructions:
- Give clear, practical answers.
- Adapt the answer to the domain.
- Include a short explanation of why the answer is appropriate.
- Avoid unnecessary jargon.
- Do not claim that legal or regulatory guidance is definitive.

Domain guidance:
${getDomainHint(currentDomain)}

Return valid JSON only, with this structure:
{
  "answer": "A response of 2-5 sentences",
  "intent": "bias|fairness|privacy|transparency|governance|general",
  "domain": "healthcare|finance|hr|legal|education|general",
  "explanation": "Short reasoning behind the answer",
  "confidence": "high|medium|low",
  "references": ["Relevant law or framework"],
  "suggestions": ["Follow-up question 1", "Follow-up question 2"]
}

Do not wrap the JSON in Markdown code fences.
`;
}

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const {
    messages,
    currentDomain = "general",
    currentIntent = "general",
  } = req.body;

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    !messages.every(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string"
    )
  ) {
    return res.status(400).json({
      error: "A non-empty messages array with valid roles and string content is required.",
    });
  }

  const latestMessage = messages[messages.length - 1].content;

  const detectedDomain = detectDomain(latestMessage);
  const detectedIntent = detectIntent(latestMessage);

  const previousDomain = currentDomain;
  const previousIntent = currentIntent;

  const resolvedDomain =
    detectedDomain === "general" && previousDomain !== "general"
      ? previousDomain
      : detectedDomain;

  const resolvedIntent =
    detectedIntent === "general" && previousIntent !== "general"
      ? previousIntent
      : detectedIntent;

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
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(
            resolvedDomain,
            resolvedIntent,
            previousDomain,
            previousIntent
          ),
        },
        ...messages,
      ],
    });

    const rawText =
      completion.choices?.[0]?.message?.content || "{}";

    let parsed;

    try {
      const cleanedText = rawText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      parsed = JSON.parse(cleanedText);
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
    console.error("Groq API error:", {
      status: err.status,
      message: err.message,
      code: err.code,
    });

    if (err.status === 401) {
      return res.status(502).json({
        error: "The AI service rejected the API credentials. Check GROQ_API_KEY in the backend environment.",
      });
    }

    if (err.status === 404) {
      return res.status(502).json({
        error: "The configured AI model is unavailable. Check the model ID and account access.",
      });
    }

    if (err.status === 429) {
      return res.status(429).json({
        error: "The AI service rate limit was reached. Please try again shortly.",
      });
    }

    return res.status(502).json({
      error: "The AI service could not complete your request. Please try again later.",
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    model: `${MODEL} (Groq)`,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Ethics Chatbot running on port ${PORT}`);
  console.log(`Configured Groq model: ${MODEL}`);
});
```
