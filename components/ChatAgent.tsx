"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, MessageSquare, Send } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store";
import {
  updateActivePageContent,
  updateActivePageTitle,
  bumpAgentContentRevision,
} from "../store/pageSlice";
import { useAuth } from "../lib/auth";
import { fetchChatMessages } from "../lib/apiClient";
import type { NoteUpdate } from "../lib/agentTools";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const CHAT_TIMEOUT_MS = 90_000;

function applyUpdates(
  updates: NoteUpdate[],
  dispatch: ReturnType<typeof useDispatch>
) {
  let contentChanged = false;
  for (const update of updates) {
    if (update.type === "content") {
      dispatch(
        updateActivePageContent({ id: update.pageId, content: update.content })
      );
      contentChanged = true;
    } else if (update.type === "title") {
      dispatch(
        updateActivePageTitle({ id: update.pageId, title: update.title })
      );
    }
  }
  if (contentChanged) {
    dispatch(bumpAgentContentRevision());
  }
}

export default function ChatAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { activePageId } = useSelector((state: RootState) => state.page);
  const dispatch = useDispatch();
  const { user } = useAuth();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setMessages([]);
      setHistoryLoaded(false);
      return;
    }

    let cancelled = false;
    setHistoryLoaded(false);

    fetchChatMessages()
      .then(({ messages: savedMessages }) => {
        if (cancelled) return;
        setMessages(savedMessages);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load chat history:", err);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading || !user || !historyLoaded) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

    setError(null);
    setInput("");

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          activePageId,
        }),
        signal: controller.signal,
      });

      let data: {
        reply?: string;
        updates?: NoteUpdate[];
        messages?: ChatMessage[];
        error?: string;
      };
      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid response from assistant");
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Request failed");
      }

      if (Array.isArray(data.updates) && data.updates.length > 0) {
        applyUpdates(data.updates, dispatch);
      }

      if (Array.isArray(data.messages)) {
        setMessages(data.messages);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.reply ?? "Done.",
          },
        ]);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setError(msg);
      }
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      clearTimeout(timeoutId);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <div className="chat-widget">
      {!isOpen && (
        <button
          type="button"
          className="chat-trigger"
          onClick={() => setIsOpen(true)}
          aria-label="Open assistant"
        >
          <MessageSquare size={24} color="#fff" />
        </button>
      )}

      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Bot size={20} color="#fff" />
              <span style={{ fontWeight: 500, color: "#fff" }}>Assistant</span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="chat-close"
              aria-label="Close assistant"
            >
              <X size={20} />
            </button>
          </div>

          <div className="chat-messages">
            {!historyLoaded ? (
              <p className="chat-empty">Loading conversation…</p>
            ) : messages.length === 0 ? (
              <p className="chat-empty">
                Ask me to read, summarize, or edit any of your notes.
              </p>
            ) : null}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`chat-bubble ${
                  m.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"
                }`}
              >
                <span className="chat-bubble-label">
                  {m.role === "user" ? "You" : "Assistant"}
                </span>
                <p className="chat-bubble-text">{m.content}</p>
              </div>
            ))}
            {isLoading && (
              <p className="chat-typing">Assistant is thinking…</p>
            )}
            {error && <p className="chat-error">{error}</p>}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="chat-input-area">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your notes…"
              className="chat-input"
              disabled={isLoading || !historyLoaded}
            />
            <button
              type="submit"
              disabled={isLoading || !historyLoaded || !input.trim()}
              className="chat-send"
              aria-label="Send message"
            >
              <Send size={16} color="#fff" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
