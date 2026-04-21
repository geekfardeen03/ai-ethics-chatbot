// SIMPLE ML-LIKE CLASSIFIER (improved over keywords)

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

// scoring-based detection (better than first match)
function classify(text, categories) {
  text = text.toLowerCase();
  let scores = {};

  for (let category in categories) {
    scores[category] = 0;
    categories[category].forEach(word => {
      if (text.includes(word)) {
        scores[category]++;
      }
    });
  }

  // pick highest score
  let best = Object.keys(scores).reduce((a, b) =>
    scores[a] > scores[b] ? a : b
  );

  return scores[best] > 0 ? best : "general";
}

function detectDomainML(text) {
  return classify(text, domains);
}

function detectIntentML(text) {
  return classify(text, intents);
}

module.exports = { detectDomainML, detectIntentML };