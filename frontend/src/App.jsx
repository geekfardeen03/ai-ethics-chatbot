import React, { useEffect, useRef } from "react";
import { useChat } from "./hooks/useChat.js";
import DomainBar from "./components/DomainBar.jsx";
import Message from "./components/Message.jsx";
import ChatInput from "./components/ChatInput.jsx";
import TypingIndicator from "./components/TypingIndicator.jsx";
import styles from "./App.module.css";

const WELCOME = {
  id: "welcome",
  type: "bot",
  content:
    "Hello! I'm your <b>AI Ethics Advisor</b>. Ask me about bias, fairness, privacy, transparency, or responsible AI in any domain — healthcare, finance, HR, legal, or education. I'll always explain <i>why</i> I give each answer.",
  intent: "general",
  domain: "general",
  explanation: null,
  confidence: null,
  references: [],
  suggestions: [
    "How can AI cause bias in loan approvals?",
    "Is patient data safe with AI diagnostics?",
    "How do I make my hiring algorithm fair?",
  ],
};

export default function App() {
  const { messages, loading, error, currentDomain, currentIntent, send, reset } =
    useChat();
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const allMessages = [WELCOME, ...messages];

  return (
    <div className={styles.shell}>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚖</span>
          <span className={styles.logoText}>AI Ethics<br />Advisor</span>
        </div>

        <nav className={styles.nav}>
          <p className={styles.navLabel}>Focus Areas</p>
          {[
            { icon: "⚠", label: "Bias & Discrimination" },
            { icon: "⚖", label: "Fairness & Equity" },
            { icon: "🔒", label: "Privacy & Data" },
            { icon: "🔍", label: "Transparency & XAI" },
            { icon: "📋", label: "Governance & Policy" },
          ].map((item) => (
            <button
              key={item.label}
              className={styles.navItem}
              onClick={() => send(`Tell me about ${item.label} in AI`)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.intentBox}>
            <p className={styles.navLabel}>Current Session</p>
            <div className={styles.sessionRow}>
              <span className={styles.sessionKey}>Domain</span>
              <span className={styles.sessionVal}>{currentDomain}</span>
            </div>
            <div className={styles.sessionRow}>
              <span className={styles.sessionKey}>Focus</span>
              <span className={styles.sessionVal}>{currentIntent}</span>
            </div>
            <div className={styles.sessionRow}>
              <span className={styles.sessionKey}>Messages</span>
              <span className={styles.sessionVal}>{messages.length}</span>
            </div>
          </div>
          <button className={styles.resetBtn} onClick={reset}>
            ↺ New conversation
          </button>
        </div>
      </aside>

      {/* ── Main chat area ───────────────────────────────────────────── */}
      <main className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.headerTitle}>AI Ethics Advisor</h1>
            <p className={styles.headerSub}>
              Bias · Fairness · Privacy · Transparency · Governance
            </p>
          </div>
          <div className={styles.headerStatus}>
            <span className={styles.statusDot} />
            Online
          </div>
        </header>

        {/* Domain bar */}
        <DomainBar currentDomain={currentDomain} />

        {/* Messages */}
        <div className={styles.messages}>
          {allMessages.map((msg) => (
            <Message key={msg.id} msg={msg} onSuggestion={send} />
          ))}
          {loading && <TypingIndicator />}
          {error && (
            <div className={styles.errorBanner}>
              ⚠ {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <ChatInput onSend={send} loading={loading} disabled={false} />
      </main>
    </div>
  );
}
