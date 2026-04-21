import React from "react";
import styles from "./DomainBar.module.css";

const DOMAINS = [
  { key: "general", label: "General", emoji: "⚖️" },
  { key: "healthcare", label: "Healthcare", emoji: "🏥" },
  { key: "finance", label: "Finance", emoji: "💳" },
  { key: "hr", label: "HR & Hiring", emoji: "👥" },
  { key: "legal", label: "Legal", emoji: "⚖" },
  { key: "education", label: "Education", emoji: "🎓" },
];

export default function DomainBar({ currentDomain }) {
  return (
    <div className={styles.bar}>
      <span className={styles.label}>Domain:</span>
      {DOMAINS.map((d) => (
        <span
          key={d.key}
          className={`${styles.chip} ${currentDomain === d.key ? styles.active : ""}`}
        >
          <span className={styles.emoji}>{d.emoji}</span>
          {d.label}
        </span>
      ))}
    </div>
  );
}
