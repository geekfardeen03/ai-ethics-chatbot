import React, { useState, useRef, useEffect } from "react";
import styles from "./ChatInput.module.css";

const STARTERS = [
  "How can AI cause bias in loan approvals?",
  "Is patient data safe with AI diagnostics?",
  "How do I make my hiring algorithm fair?",
  "What is the EU AI Act?",
  "How should AI explain its decisions?",
  "What is disparate impact in AI?",
];

export default function ChatInput({ onSend, loading, disabled }) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [text]);

  const submit = () => {
    if (!text.trim() || loading || disabled) return;
    onSend(text.trim());
    setText("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Starter prompts — only show when no text */}
      {!text && (
        <div className={styles.starters}>
          {STARTERS.map((s) => (
            <button key={s} className={styles.starter} onClick={() => onSend(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <div className={styles.row}>
        <textarea
          ref={textareaRef}
          className={styles.input}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about AI ethics…"
          disabled={disabled}
        />
        <button
          className={styles.sendBtn}
          onClick={submit}
          disabled={!text.trim() || loading || disabled}
        >
          {loading ? <span className={styles.spinner} /> : "Send"}
        </button>
      </div>
      <p className={styles.hint}>Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
