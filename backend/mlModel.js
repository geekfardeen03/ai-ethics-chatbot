const domains = {
  healthcare: ["patient", "hospital", "doctor", "medical", "diagnosis"],
  finance: ["loan", "bank", "credit", "fraud", "investment"],
  hr: ["hiring", "resume", "employee", "recruit", "salary"],
  legal: ["court", "judge", "law", "gdpr", "compliance"],
  education: ["student", "exam", "school", "grading", "university"]
};

const intents = {
  bias: ["bias", "discrimination", "unfair"],
  fairness: ["fair", "equal", "justice"],
  privacy: ["privacy", "data", "gdpr", "consent"],
  transparency: ["explain", "black box", "interpret"],
  governance: ["policy", "regulation", "law"]
};

function classify(text, categories) {
  if (typeof text !== "string" || !text.trim()) {
    return "general";
  }

  const normalizedText = text.toLowerCase();
  const scores = {};

  for (const category in categories) {
    scores[category] = 0;

    for (const word of categories[category]) {
      if (normalizedText.includes(word)) {
        scores[category]++;
      }
    }
  }

  const bestCategory = Object.keys(scores).reduce((a, b) =>
    scores[a] >= scores[b] ? a : b
  );

  return scores[bestCategory] > 0
    ? bestCategory
    : "general";
}

function detectDomainML(text) {
  return classify(text, domains);
}

function detectIntentML(text) {
  return classify(text, intents);
}

module.exports = {
  detectDomainML,
  detectIntentML
};
