```javascript
const domains = {
  healthcare: ["patient", "hospital", "doctor", "medical", "diagnosis"],
  finance: ["loan", "bank", "credit", "fraud", "investment"],
  hr: ["hiring", "resume", "employee", "recruit", "salary"],
  legal: ["court", "judge", "law", "gdpr", "compliance"],
  education: ["student", "exam", "school", "grading", "university"],
};

const intents = {
  bias: ["bias", "biased", "discrimination", "unfair"],
  fairness: ["fair", "equal", "justice", "equity"],
  privacy: ["privacy", "data", "gdpr", "consent"],
  transparency: ["explain", "black box", "interpret"],
  governance: ["policy", "regulation", "law", "oversight"],
};

function classify(text, categories) {
  if (typeof text !== "string" || !text.trim()) {
    return "general";
  }

  const input = text.toLowerCase();
  let bestCategory = "general";
  let maxScore = 0;

  for (const [category, keywords] of Object.entries(categories)) {
    let score = 0;

    for (const keyword of keywords) {
      if (input.includes(keyword)) {
        score++;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestCategory = category;
    }
  }

  return maxScore > 0 ? bestCategory : "general";
}

function detectDomainML(text) {
  return classify(text, domains);
}

function detectIntentML(text) {
  return classify(text, intents);
}

module.exports = {
  detectDomainML,
  detectIntentML,
};
```
