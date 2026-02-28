"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch, ApiError } from "@/lib/api";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: number;
  text: string;
  created_at: string;
  sender_role: "client" | "provider" | "unknown";
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user, tokens } = useAuth();
  const responseId = params?.id != null ? String(params.id) : null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (!responseId || !tokens?.access) {
      setLoading(false);
      if (!tokens?.access) setError("Not authenticated.");
      else if (!responseId) setError("Invalid chat.");
      return;
    }

    let cancelled = false;

    const fetchMessages = () => {
      apiFetch<ChatMessage[]>(`/api/my-responses/${responseId}/messages/`, {
        method: "GET",
        token: tokens.access,
      })
        .then((data) => {
          if (cancelled) return;
          setMessages(Array.isArray(data) ? data : []);
          setError("");
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof ApiError ? err.message : "Failed to load chat.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [responseId, tokens?.access]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseId || !tokens?.access) return;
    const text = input.trim();
    if (!text) return;
    setSending(true);
    try {
      const msg = await apiFetch<ChatMessage>(`/api/my-responses/${responseId}/messages/`, {
        method: "POST",
        token: tokens.access,
        body: { text },
      });
      setInput("");
      setMessages((prev) => [...prev, msg]);
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  if (!responseId) {
    return (
      <RequireAuth role="any">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-red-600">Invalid chat.</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-4 inline-block text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            ← Go back
          </button>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth role="any">
      <div className="mx-auto flex max-w-3xl flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 sm:text-xl">Chat</h1>
            <p className="text-xs text-gray-500 sm:text-sm">
              Conversation between client and executor for this job.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 sm:text-sm"
          >
            ← Back
          </button>
        </div>

        {loading && <p className="text-gray-500">Loading chat…</p>}
        {error && !loading && (
          <p className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div
          ref={listRef}
          className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-md border border-gray-100 bg-slate-50 p-3"
          style={{ maxHeight: "60vh" }}
        >
          {messages.length === 0 && !loading && !error && (
            <p className="text-sm text-gray-500">No messages yet. Start the conversation.</p>
          )}
          {messages.map((m) => {
            const isMine =
              user &&
              ((m.sender_role === "client" && user.role === "client") ||
                (m.sender_role === "provider" && user.role === "provider"));
            return (
              <div
                key={m.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    isMine
                      ? "bg-primary text-white rounded-br-none"
                      : "bg-white text-gray-900 rounded-bl-none border border-gray-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  <p className={`mt-1 text-[10px] ${isMine ? "text-primary/80" : "text-gray-400"}`}>
                    {formatTime(m.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSend} className="mt-1 flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Write a message…"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="self-end rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </RequireAuth>
  );
}

