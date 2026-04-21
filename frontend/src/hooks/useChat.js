import { useState, useCallback, useRef } from "react";
import { sendChatMessage } from "../utils/api.js";

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentDomain, setCurrentDomain] = useState("general");
  const [currentIntent, setCurrentIntent] = useState("general");
  const historyRef = useRef([]);

  const send = useCallback(
    async (text) => {
      if (!text.trim() || loading) return;

      const userMsg = { role: "user", content: text };
      historyRef.current = [...historyRef.current, userMsg];

      setMessages((prev) => [
        ...prev,
        { id: Date.now(), type: "user", content: text },
      ]);
      setLoading(true);
      setError(null);

      try {
        const data = await sendChatMessage({
          messages: historyRef.current,
          currentDomain,
          currentIntent,
        });

        // Track domain/intent shift for divider
        const topicChanged = data.domainChanged || data.intentChanged;

        const assistantMsg = { role: "assistant", content: data.answer };
        historyRef.current = [...historyRef.current, assistantMsg];

        if (data.detectedDomain && data.detectedDomain !== "general") {
          setCurrentDomain(data.detectedDomain);
        }
        if (data.detectedIntent && data.detectedIntent !== "general") {
          setCurrentIntent(data.detectedIntent);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            type: "bot",
            content: data.answer,
            intent: data.intent,
            domain: data.detectedDomain,
            explanation: data.explanation,
            confidence: data.confidence,
            references: data.references || [],
            suggestions: data.suggestions || [],
            topicChanged,
            previousDomain: data.previousDomain,
            previousIntent: data.previousIntent,
          },
        ]);
      } catch (err) {
        setError(err.message);
        historyRef.current = historyRef.current.slice(0, -1);
      } finally {
        setLoading(false);
      }
    },
    [loading, currentDomain, currentIntent]
  );

  const reset = useCallback(() => {
    setMessages([]);
    historyRef.current = [];
    setCurrentDomain("general");
    setCurrentIntent("general");
    setError(null);
  }, []);

  return { messages, loading, error, currentDomain, currentIntent, send, reset };
}
