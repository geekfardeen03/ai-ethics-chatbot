import React, { useState } from "react";
import styles from "./Message.module.css";

const INTENT_META = {
  bias:         { label: "Bias concern",   cls: "intentBias"         },
  fairness:     { label: "Fairness",       cls: "intentFairness"     },
  privacy:      { label: "Privacy",        cls: "intentPrivacy"      },
  transparency: { label: "Transparency",   cls: "intentTransparency" },
  governance:   { label: "Governance",     cls: "intentGovernance"   },
  general:      { label: "General ethics", cls: "intentGeneral"      },
};

const CONFIDENCE_META = {
  high:   { label: "High confidence",   cls: "confHigh"   },
  medium: { label: "Medium confidence", cls: "confMedium" },
  low:    { label: "Low confidence",    cls: "confLow"    },
};

export default function Message({ msg, onSuggestion }) {
  const [showRefs, setShowRefs] = useState(false);

  if (msg.type === "user") {
    return (
      <div className={`${styles.row} ${styles.userRow}`}>
        <div className={styles.userAvatar}>You</div>
        <div className={`${styles.bubble} ${styles.userBubble}`}>
          {msg.content}
        </div>
      </div>
    );
  }

  const intentMeta = INTENT_META[msg.intent] || INTENT_META.general;
  const confMeta = CONFIDENCE_META[msg.confidence] || CONFIDENCE_META.medium;

  return (
    <div className={styles.row}>
      <div className={styles.botAvatar}>AI</div>
      <div className={styles.botWrapper}>
        {/* Topic shift notice */}
        {msg.topicChanged && (
          <div className={styles.topicShift}>
            <span className={styles.shiftDot} />
            Topic shift detected — now in{" "}
            <strong>{msg.domain !== "general" ? msg.domain : "general"}</strong> domain
          </div>
        )}

        <div className={`${styles.bubble} ${styles.botBubble}`}>
          {/* Badges row */}
          <div className={styles.badges}>
            <span className={`${styles.badge} ${styles[intentMeta.cls]}`}>
              {intentMeta.label}
            </span>
            <span className={`${styles.badge} ${styles[confMeta.cls]}`}>
              {confMeta.label}
            </span>
          </div>

          {/* Answer */}
          <div
            className={styles.answer}
            dangerouslySetInnerHTML={{ __html: msg.content }}
          />

          {/* Explainability */}
          {msg.explanation && (
            <div className={styles.explanation}>
              <span className={styles.explainLabel}>Why this answer:</span>{" "}
              {msg.explanation}
            </div>
          )}

          {/* References toggle */}
          {msg.references && msg.references.length > 0 && (
            <div className={styles.refsSection}>
              <button
                className={styles.refsToggle}
                onClick={() => setShowRefs((v) => !v)}
              >
                {showRefs ? "▾" : "▸"} References ({msg.references.length})
              </button>
              {showRefs && (
                <ul className={styles.refsList}>
                  {msg.references.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Follow-up suggestions */}
        {msg.suggestions && msg.suggestions.length > 0 && (
          <div className={styles.suggestions}>
            {msg.suggestions.map((s, i) => (
              <button
                key={i}
                className={styles.sugBtn}
                onClick={() => onSuggestion(s)}
              >
                {s} →
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
