"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MessageStatus = "new" | "read" | "resolved";
type ContactMessage = {
  id: string;
  full_name: string;
  email: string;
  subject: string;
  other_subject: string | null;
  message: string;
  status: MessageStatus;
  created_at: string;
};

const FILTERS: Array<{ key: "all" | MessageStatus; label: string }> = [
  { key: "all", label: "All messages" },
  { key: "new", label: "New" },
  { key: "read", label: "Read" },
  { key: "resolved", label: "Resolved" },
];

const STATUS_STYLE: Record<MessageStatus, string> = {
  new: "bg-amber-100 text-amber-800",
  read: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
};

export default function AdminContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filter, setFilter] = useState<"all" | MessageStatus>("all");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase.rpc("admin_list_contact_messages");
    if (loadError) {
      setError(`${loadError.message}. Run supabase_contact_messages.sql in the Supabase SQL Editor.`);
    } else {
      setError("");
      setMessages((data ?? []) as ContactMessage[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { queueMicrotask(() => { void loadMessages(); }); }, [loadMessages]);

  async function updateStatus(message: ContactMessage, status: MessageStatus) {
    if (message.status === status) return;
    setUpdatingId(message.id);
    const { error: updateError } = await supabase.rpc("admin_update_contact_message_status", {
      p_message_id: message.id,
      p_status: status,
    });
    if (updateError) setError(updateError.message);
    else setMessages((current) => current.map((item) => item.id === message.id ? { ...item, status } : item));
    setUpdatingId(null);
  }

  async function viewMessage(message: ContactMessage) {
    setSelectedMessageId(message.id);
    if (message.status === "new") await updateStatus(message, "read");
  }

  function replyLink(message: ContactMessage) {
    const subject = message.subject === "Other" && message.other_subject
      ? `Re: ${message.other_subject}`
      : `Re: ${message.subject}`;
    const body = `Hi ${message.full_name},\n\n\n\nBest,\nBrewora Coffee Shop`;
    const query = new URLSearchParams({ view: "cm", fs: "1", to: message.email, su: subject, body });
    return `https://mail.google.com/mail/?${query.toString()}`;
  }

  const counts = useMemo(() => ({
    all: messages.length,
    new: messages.filter((message) => message.status === "new").length,
    read: messages.filter((message) => message.status === "read").length,
    resolved: messages.filter((message) => message.status === "resolved").length,
  }), [messages]);
  const filtered = filter === "all" ? messages : messages.filter((message) => message.status === filter);
  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl p-5 sm:p-7">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a16a37]">Customer support</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#21140b]">Contact Messages</h1>
          <p className="mt-1 text-sm text-[#817064]">Messages sent from the Contact Us page.</p>
        </div>
        <button type="button" onClick={() => void loadMessages()} disabled={loading} className="rounded-lg border border-[#e5d8cb] bg-white px-4 py-2 text-sm font-semibold text-[#5a3e2b] hover:bg-[#faf6f2] disabled:opacity-50">
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${filter === item.key ? "border-[#7c4a1e] bg-[#7c4a1e] text-white" : "border-[#e5d8cb] bg-white text-[#665344] hover:border-[#7c4a1e]"}`}>
            {item.label} <span className="ml-1 opacity-75">{counts[item.key]}</span>
          </button>
        ))}
      </div>

      {loading && messages.length === 0 ? (
        <div className="rounded-xl border border-[#eee3d9] bg-white p-10 text-center text-sm text-[#8b7766]">Loading messages…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d9c9b9] bg-white p-12 text-center text-sm text-[#8b7766]">No {filter === "all" ? "contact" : filter} messages.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((message) => (
            <article key={message.id} className="rounded-lg border border-[#eee3d9] bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="max-w-full truncate font-bold text-[#21140b]">{message.full_name}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${STATUS_STYLE[message.status]}`}>{message.status}</span>
                  <span className="min-w-0 truncate text-xs text-[#7c4a1e]">{message.email}</span>
                  <span className="text-xs text-[#907b69]">{message.subject === "Other" ? `Other: ${message.other_subject}` : message.subject}</span>
                  <span className="text-xs text-[#9a8777]">{new Date(message.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => void viewMessage(message)} className="rounded-md border border-[#e5d8cb] px-3 py-1.5 text-xs font-bold text-[#5a3e2b] hover:bg-[#faf6f2]">View message</button>
                  <a href={replyLink(message)} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#7c4a1e] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#633a18]">Reply</a>
                  <select aria-label={`Status for message from ${message.full_name}`} value={message.status} disabled={updatingId === message.id} onChange={(event) => void updateStatus(message, event.target.value as MessageStatus)} className="rounded-md border border-[#e5d8cb] bg-white px-2 py-1.5 text-xs text-[#3e332b] outline-none focus:border-[#7c4a1e] disabled:opacity-60">
                    <option value="new">New</option>
                    <option value="read">Read</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMessageId(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="contact-message-title" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee3d9] pb-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[#907b69]">{selectedMessage.subject === "Other" ? `Other: ${selectedMessage.other_subject}` : selectedMessage.subject}</p>
                <h2 id="contact-message-title" className="mt-1 break-words text-xl font-extrabold text-[#21140b]">{selectedMessage.full_name}</h2>
                <a href={`mailto:${encodeURIComponent(selectedMessage.email)}`} className="mt-1 inline-block break-all text-sm text-[#7c4a1e] hover:underline">{selectedMessage.email}</a>
              </div>
              <button type="button" aria-label="Close message" onClick={() => setSelectedMessageId(null)} className="rounded-md border border-[#e5d8cb] px-3 py-2 text-sm font-semibold text-[#665344] hover:bg-[#faf6f2]">Close</button>
            </div>
            <p className="mt-4 text-xs text-[#9a8777]">Received {new Date(selectedMessage.created_at).toLocaleString()}</p>
            <div className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-[#faf7f4] p-4 text-sm leading-7 text-[#4c4037]">{selectedMessage.message}</div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#7b6a5d]">Status
                <select value={selectedMessage.status} disabled={updatingId === selectedMessage.id} onChange={(event) => void updateStatus(selectedMessage, event.target.value as MessageStatus)} className="rounded-md border border-[#e5d8cb] bg-white px-2 py-2 text-sm text-[#3e332b] outline-none focus:border-[#7c4a1e] disabled:opacity-60">
                  <option value="new">New</option>
                  <option value="read">Read</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
              <a href={replyLink(selectedMessage)} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#7c4a1e] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#633a18]">Reply by email</a>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
