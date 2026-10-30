```javascript
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const Groq = require("groq-sdk");
const { detectDomainML, detectIntentML } = require("./mlModel");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3001;
const MODEL = "openai/gpt-oss-120b";

if (!process.env.GROQ_API_KEY) {
  console.error("GROQ_API_KEY is missing from the environment.");
  process.exit(1);
}

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
    error: "Too many requests. Please try again later.",
  },
});

app.use("/api/", limiter);

// Domain-specific guidance
function getDomainHint(domain) {
  switch (domain) {
    case "healthcare":
      return "Consider patient privacy, HIPAA, and clinical safety.";
    case "finance":
      return "Consider financial fairness, credit scoring, and relevant regulations.";
    case "hr":
      return "Consider hiring bias, equal opportunity, and EEOC guidance.";
    case "legal":
      return "Consider due process, legal accountability, and applicable laws.";
    case "education":
      return "Consider fair grading, accessibility, and student data privacy.";
    default:
      return "Use general responsible AI and ethical principles.";
  }
}

// Build system prompt
function buildSystemPrompt(
  currentDomain,
  currentIntent,
  previousDomain,
  previousIntent
) {
  const domainChanged =
    previousDomain !== "general" &&
    currentDomain !== "general" &&
    currentDomain !== previousDomain;

  const intentChanged =
    previousIntent !== "general" &&
    currentIntent !== "general" &&
    currentIntent !== previousIntent;

  return `
You are an AI Ethics Advisor focused on responsible AI.

Current context:
- Domain: ${currentDomain}
- Intent: ${currentIntent}

${
  domainChanged
    ? `The domain changed from ${previousDomain} to ${currentDomain}. Adapt your answer accordingly.`
    : ""
}

${
  intentChanged
    ? `The intent changed from ${previousIntent} to ${currentIntent}. Adjust your response accordingly.`
    : ""
}

Instructions:
- Provide clear, practical answers.
- Use simple language and avoid unnecessary technical terms.
- Explain briefly why your recommendation is appropriate.
- Consider the risks and limitations of AI systems.
- Do not present legal or medical information as definitive professional advice.
- Use relevant regulatory references when appropriate.
- Return valid JSON only. Do not use Markdown code fences.

Domain guidance:
${getDomainHint(currentDomain)}

Return a JSON object with exactly these fields:
{
  "answer": "A clear response in 2-5 sentences",
  "intent": "bias|fairness|privacy|transparency|governance|general",
  "domain": "healthcare|finance|hr|legal|education|general",
  "explanation": "A short explanation of the reasoning",
  "confidence": "high|medium|low",
  "references": ["Relevant law or ethical framework"],
  "suggestions": ["Follow-up question 1", "Follow-up question 2"]
}

Ensure the domain and intent values match the available categories.
`;
}

// Validate conversation messages
function validateMessages(messages) {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string"
    ) &&
    messages[messages.length - 1].role === "user"
  );
}

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  const {
    messages,
    currentDomain = "general",
    currentIntent = "general",
  } = req.body || {};

  if (!validateMessages(messages)) {
    return res.status(400).json({
      error:
        "Provide a non-empty messages array with valid roles and string content. The latest message must be from the user.",
    });
  }

  const latestMessage = messages[messages.length - 1].content;

  // Use the scoring-based classifiers from mlModel.js
  const detectedDomain = detectDomainML(latestMessage);
  const detectedIntent = detectIntentML(latestMessage);

  // Preserve the previous context when the new message is general
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
    previousDomain !== "general" &&
    resolvedDomain !== "general" &&
    previousDomain !== resolvedDomain;

  const intentChanged =
    previousIntent !== "general" &&
    resolvedIntent !== "general" &&
    previousIntent !== resolvedIntent;

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
        ...messages.map(({ role, content }) => ({
          role,
          content,
        })),
      ],
    });

    const rawText =
      completion.choices?.[0]?.message?.content?.trim() || "";

    if (!rawText) {
      throw new Error("The AI model returned an empty response.");
    }

    let parsed;

    try {
      const cleanedText = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim();

      parsed = JSON.parse(cleanedText);

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        typeof parsed.answer !== "string"
      ) {
        throw new Error("The AI response did not match the expected format.");
      }
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        console.error("Could not parse model JSON response.");
      } else {
        console.error("Invalid model response format:", parseError.message);
      }

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
        error: "The Groq API key is invalid or expired. Check GROQ_API_KEY in Render.",
      });
    }

    if (err.status === 404) {
      return res.status(502).json({
        error: "The configured Groq model was not found or is unavailable to your account.",
      });
    }

    if (err.status === 429) {
      return res.status(503).json({
        error: "The AI service is temporarily rate-limited. Please try again shortly.",
      });
    }

    return res.status(502).json({
      error: "Unable to get an AI response. Please try again later.",
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    model: MODEL,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Ethics Chatbot running on port ${PORT}`);
  console.log(`Configured model: ${MODEL}`);
  console.log(`Health endpoint: /api/health`);
});
```
