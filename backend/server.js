require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Groq = require("groq-sdk");

const {
  detectDomainML,
  detectIntentML
} = require("./mlModel");

const app = express();

app.set("trust proxy", 1);

const PORT = process.env.PORT || 3001;
const MODEL = "openai/gpt-oss-120b";

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "http://localhost:5173";

if (!process.env.GROQ_API_KEY) {
  console.error(
    "GROQ_API_KEY is missing from the environment."
  );

  process.exit(1);
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

app.use(
  cors({
    origin: [
      FRONTEND_URL,
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "1mb" }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please wait a minute and try again."
  }
});

app.use("/api/", apiLimiter);

function getDomainHint(domain) {
  const hints = {
    healthcare:
      "Focus on patient safety, medical privacy, informed consent, accessibility, and fairness in healthcare AI.",

    finance:
      "Focus on financial fairness, credit discrimination, explainability, fraud detection, and consumer protection.",

    hr:
      "Focus on fair hiring, employment discrimination, accessibility, privacy, and responsible employee evaluation.",

    legal:
      "Focus on legal compliance, accountability, privacy, transparency, and the limitations of automated legal decisions.",

    education:
      "Focus on equal learning opportunities, student privacy, fair grading, accessibility, and responsible educational AI.",

    general:
      "Focus on responsible AI principles, fairness, transparency, privacy, safety, and accountability."
  };

  return hints[domain] || hints.general;
}

function buildSystemPrompt(
  currentDomain,
  currentIntent,
  previousDomain,
  previousIntent
) {
  const domainHint = getDomainHint(currentDomain);

  return `
You are an AI Ethics Advisor focused on responsible and ethical AI.

Your job is to help users understand AI ethics clearly and practically.

CURRENT CONTEXT
- Detected domain: ${currentDomain}
- Detected intent: ${currentIntent}
- Previous domain: ${previousDomain || "none"}
- Previous intent: ${previousIntent || "none"}

DOMAIN GUIDANCE
${domainHint}

RESPONSE RULES
1. Use simple, clear English.
2. Explain technical terms when necessary.
3. Be respectful, neutral, and practical.
4. Identify ethical risks and explain why they matter.
5. Give actionable suggestions when appropriate.
6. Do not invent laws, legal citations, research papers, or sources.
7. Distinguish general ethical guidance from legal requirements.
8. Do not claim that AI systems are completely fair, safe, or unbiased.
9. Keep answers focused on the user's question.
10. If the question is unrelated to AI ethics, answer briefly when appropriate and explain the connection to responsible AI if useful.
11. If the domain or intent changes, adapt your answer to the new topic.
12. Never claim to have verified a source unless you actually have reliable information supporting that claim.
13. Write explanations in a way that a student or beginner can understand.

OUTPUT FORMAT
Return exactly one valid JSON object.
Do not use Markdown code fences.
Do not add text before or after the JSON object.

Use this structure:
{
  "answer": "A clear answer to the user's question",
  "intent": "${currentIntent}",
  "domain": "${currentDomain}",
  "explanation": "A short explanation of the ethical reasoning",
  "confidence": 0.85,
  "references": [],
  "suggestions": [
    "A practical suggestion"
  ]
}

FIELD RULES
- answer: string containing the main response.
- intent: string identifying the relevant ethical topic.
- domain: string identifying the relevant application domain.
- explanation: string explaining the reasoning.
- confidence: number between 0 and 1 representing confidence in the classification and response.
- references: array of real, relevant references. Use an empty array if reliable references are unavailable.
- suggestions: array of practical suggestions.
`;
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "Messages must be a non-empty array.";
  }

  for (const message of messages) {
    if (!message || typeof message !== "object") {
      return "Each message must be an object.";
    }

    if (
      message.role !== "user" &&
      message.role !== "assistant"
    ) {
      return "Message role must be user or assistant.";
    }

    if (
      typeof message.content !== "string" ||
      message.content.trim().length === 0
    ) {
      return "Message content must be a non-empty string.";
    }

    if (message.content.length > 12000) {
      return "A message cannot exceed 12000 characters.";
    }
  }

  if (messages[messages.length - 1].role !== "user") {
    return "The last message must be from the user.";
  }

  return null;
}

function parseAIResponse(content) {
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The AI returned an empty response.");
  }

  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    const parsed = JSON.parse(cleaned);

    return {
      answer:
        typeof parsed.answer === "string"
          ? parsed.answer
          : content,
      intent:
        typeof parsed.intent === "string"
          ? parsed.intent
          : "general",
      domain:
        typeof parsed.domain === "string"
          ? parsed.domain
          : "general",
      explanation:
        typeof parsed.explanation === "string"
          ? parsed.explanation
          : "",
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.7,
      references:
        Array.isArray(parsed.references)
          ? parsed.references
          : [],
      suggestions:
        Array.isArray(parsed.suggestions)
          ? parsed.suggestions
          : []
    };
  } catch {
    return {
      answer: content,
      intent: "general",
      domain: "general",
      explanation:
        "The response could not be parsed into the expected JSON format.",
      confidence: 0.5,
      references: [],
      suggestions: []
    };
  }
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "AI Ethics Advisor backend is running."
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    model: MODEL,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const {
      messages,
      currentDomain,
      currentIntent,
      previousDomain,
      previousIntent
    } = req.body || {};

    const validationError = validateMessages(messages);

    if (validationError) {
      return res.status(400).json({
        error: validationError
      });
    }

    const latestMessage =
      messages[messages.length - 1].content.trim();

    let detectedDomain = "general";
    let detectedIntent = "general";

    try {
      detectedDomain =
        detectDomainML(latestMessage) || "general";

      detectedIntent =
        detectIntentML(latestMessage) || "general";
    } catch (classificationError) {
      console.error(
        "Classification error:",
        classificationError.message
      );
    }

    const finalDomain =
      detectedDomain !== "general"
        ? detectedDomain
        : currentDomain || previousDomain || "general";

    const finalIntent =
      detectedIntent !== "general"
        ? detectedIntent
        : currentIntent || previousIntent || "general";

    const domainChanged =
      Boolean(previousDomain) &&
      previousDomain !== finalDomain;

    const intentChanged =
      Boolean(previousIntent) &&
      previousIntent !== finalIntent;

    const systemPrompt = buildSystemPrompt(
      finalDomain,
      finalIntent,
      previousDomain,
      previousIntent
    );

    const conversationMessages = messages.map(message => ({
      role: message.role,
      content: message.content.trim()
    }));

    const completion =
      await groq.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...conversationMessages
        ],
        max_tokens: 1024,
        temperature: 0.3,
        response_format: {
          type: "json_object"
        }
      });

    const aiContent =
      completion.choices?.[0]?.message?.content;

    const parsedResponse = parseAIResponse(aiContent);

    return res.status(200).json({
      ...parsedResponse,
      domain: finalDomain,
      intent: finalIntent,
      detectedDomain,
      detectedIntent,
      domainChanged,
      intentChanged,
      model: MODEL
    });
  } catch (error) {
    const status = error.status || error.statusCode;

    console.error("Chat request failed:", {
      status,
      code: error.code,
      message: error.message
    });

    if (status === 401) {
      return res.status(502).json({
        error:
          "Groq authentication failed. Check the GROQ_API_KEY configured on Render."
      });
    }

    if (status === 404) {
      return res.status(502).json({
        error:
          "The configured Groq model was not found or is unavailable. Check the model ID."
      });
    }

    if (status === 429) {
      return res.status(429).json({
        error:
          "The AI service is temporarily rate-limited. Please try again shortly."
      });
    }

    if (
      error instanceof SyntaxError &&
      error.status === 400
    ) {
      return res.status(400).json({
        error: "Invalid JSON request body."
      });
    }

    return res.status(502).json({
      error:
        "The AI service could not process your request. Please try again."
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found."
  });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "An unexpected server error occurred."
  });
});

app.listen(PORT, () => {
  console.log(`AI Ethics Advisor backend running on port ${PORT}`);
  console.log(`Groq model configured: ${MODEL}`);
});
