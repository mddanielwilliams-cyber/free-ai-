"use client";

import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";

type ChatSummary = { id: string; title: string; updatedAt: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; attachmentName?: string | null };
type AuthUser = { id: string; name: string; email: string; avatarIndex: number | null; profileComplete: boolean };

const avatarOptions = Array.from({ length: 50 }, (_, index) => ({
  index,
  src: `https://i.pravatar.cc/160?img=${index + 1}`,
  label: `Photo ${index + 1}`,
}));

function avatarUrl(index: number | null | undefined) {
  return typeof index === "number" ? `https://i.pravatar.cc/160?img=${index + 1}` : "";
}
type IconName = "menu" | "plus" | "code" | "bookmark" | "youtube" | "send" | "paperclip" | "mic" | "trash" | "copy" | "check" | "spark" | "close" | "stop";

const icons: Record<IconName, ReactNode> = {
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  code: <><path d="m8 9-3 3 3 3m8-6 3 3-3 3m-2-9-4 12" /></>,
  bookmark: <><path d="M6 4h12v17l-6-4-6 4z" /></>,
  youtube: <><rect x="3" y="6" width="18" height="12" rx="4" /><path d="m10 9 5 3-5 3z" /></>,
  send: <><path d="m5 12 14-7-4 14-3-6zM12 13l7-8" /></>,
  paperclip: <><path d="m15 7-6.5 6.5a2.1 2.1 0 0 0 3 3L18 10a4 4 0 0 0-5.7-5.7L5.4 11.2a6 6 0 0 0 8.5 8.5L20 13.6" /></>,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></>,
  trash: <><path d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m3 0-1 14H7L6 7" /></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  spark: <><path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8zM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8z" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
  stop: <><rect x="7" y="7" width="10" height="10" rx="1" /></>,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="copy-btn" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }} aria-label="Copy code"><Icon name={copied ? "check" : "copy"} size={15} />{copied ? "Copied" : "Copy"}</button>;
}

function RichText({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return <div className="rich-text">{parts.map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const inner = part.slice(3, -3);
      const firstBreak = inner.indexOf("\n");
      const language = firstBreak > -1 ? inner.slice(0, firstBreak).trim() : "code";
      const code = firstBreak > -1 ? inner.slice(firstBreak + 1) : inner;
      return <div className="code-block" key={index}><div className="code-head"><span>{language || "code"}</span><CopyButton text={code} /></div><pre><code>{code}</code></pre></div>;
    }
    return <div key={index} className="text-part">{part.split("\n").map((line, i) => <span key={i}>{line}{i < part.split("\n").length - 1 && <br />}</span>)}</div>;
  })}</div>;
}

function getDeviceId() {
  const key = "shehryar-ai-device";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export default function ChatApp() {
  const [deviceId, setDeviceId] = useState("");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [pendingUser, setPendingUser] = useState<AuthUser | null>(null);
  const [activeNav, setActiveNav] = useState<"new" | "coding" | "saved" | "youtube" | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [onboardingName, setOnboardingName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState<number | null>(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const ownerId = user ? `user-${user.id}` : "";

  useEffect(() => { setDeviceId(getDeviceId()); }, []);
  useEffect(() => {
    fetch("/api/auth/me").then((res) => res.json()).then((data) => {
      if (!data.user) return;
      if (data.user.profileComplete) setUser(data.user);
      else {
        setPendingUser(data.user);
        setOnboardingName(data.user.name === "New user" ? "" : data.user.name);
        setSelectedAvatar(typeof data.user.avatarIndex === "number" ? data.user.avatarIndex : null);
      }
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!user) { setChats([]); setListLoading(false); return; }
    setActiveId(null); setMessages([]); setListLoading(true);
    void refreshChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    if (authBusy) return;
    setAuthBusy(true); setAuthError("");
    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload = { email: authForm.email, password: authForm.password };
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setAuthOpen(false); setAuthForm({ name: "", email: "", password: "" });
      if (data.user.profileComplete) setUser(data.user);
      else {
        setPendingUser(data.user);
        setOnboardingName(data.user.name === "New user" ? "" : data.user.name);
        setSelectedAvatar(typeof data.user.avatarIndex === "number" ? data.user.avatarIndex : null);
        setOnboardingStep(1); setOnboardingError("");
      }
    } catch (reason) {
      setAuthError((reason as Error).message || "Kuch ghalat ho gaya.");
    } finally { setAuthBusy(false); }
  }

  async function finishOnboarding() {
    if (!onboardingName.trim() || selectedAvatar === null || onboardingBusy) return;
    setOnboardingBusy(true); setOnboardingError("");
    try {
      const res = await fetch("/api/auth/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: onboardingName, avatarIndex: selectedAvatar }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Profile save nahi ho saki.");
      setUser(data.user); setPendingUser(null); setOnboardingStep(1); setOnboardingError("");
    } catch (reason) {
      setOnboardingError((reason as Error).message || "Profile save nahi ho saki.");
    } finally { setOnboardingBusy(false); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null); setPendingUser(null); setActiveId(null); setMessages([]); setChats([]);
  }

  async function refreshChats() {
    if (!user) return;
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChats(data.conversations);
    } catch { setError("Saved chats load nahi ho sake."); } finally { setListLoading(false); }
  }

  async function newChat(prefill = "") {
    if (loading) return;
    setError(""); setActiveId(null); setMessages([]); setInput(prefill); setSidebarOpen(false);
    if (!user) return;
    try {
      const res = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: ownerId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setChats((old) => [data.conversation, ...old]);
      setActiveId(data.conversation.id);
    } catch { setError("Nayi chat create nahi ho saki."); }
  }

  async function openChat(id: string) {
    if (loading) return;
    setError(""); setSidebarOpen(false); setActiveId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(data.messages);
    } catch { setError("Chat load nahi ho saki."); }
  }

  async function deleteChat(id: string) {
    if (!confirm("Delete this chat permanently?")) return;
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setChats((old) => old.filter((chat) => chat.id !== id));
      if (activeId === id) { setActiveId(null); setMessages([]); }
    }
  }

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const baseText = input.trim();
    if ((!baseText && !attachment) || loading) return;
    let conversationId = activeId;
    if (user && !conversationId) {
      const res = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: ownerId }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Chat create nahi ho saki."); return; }
      conversationId = data.conversation.id;
      setActiveId(conversationId);
      setChats((old) => [data.conversation, ...old]);
    }
    const completeText = attachment ? `${baseText || "Please analyze this file."}\n\n--- Attached file: ${attachment.name} ---\n${attachment.content}` : baseText;
    const shownText = baseText || `Analyze ${attachment?.name}`;
    const history = messages.filter((message) => message.role === "user" || message.role === "assistant").map(({ role, content }) => ({ role, content }));
    const temp: ChatMessage = { id: `temp-${Date.now()}`, role: "user", content: shownText, attachmentName: attachment?.name };
    setMessages((old) => [...old, temp]); setInput(""); setAttachment(null); setError(""); setLoading(true);
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ conversationId, message: completeText, attachmentName: temp.attachmentName, history }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "AI response failed" }));
        throw new Error(data.error ?? "AI response failed");
      }
      if (!res.body) throw new Error("AI response stream is unavailable.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const responseId = `ai-${Date.now()}`;
      let reply = "";
      let assistantAdded = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (!text) continue;
        reply += text;
        if (!assistantAdded) {
          assistantAdded = true;
          setMessages((old) => [...old, { id: responseId, role: "assistant", content: reply }]);
        } else {
          setMessages((old) => old.map((message) => message.id === responseId ? { ...message, content: reply } : message));
        }
      }
      if (!reply) throw new Error("AI returned an empty response. Please try again.");
      if (user) await refreshChats();
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError((reason as Error).message || "Kuch ghalat ho gaya. Dobara try karein.");
    } finally { setLoading(false); abortRef.current = null; }
  }

  async function onFile(file?: File) {
    if (!file) return;
    if (file.size > 300_000) { setError("File 300 KB se chhoti honi chahiye."); return; }
    const allowed = /\.(txt|md|js|jsx|ts|tsx|html|css|json|py|java|c|cpp|cs|php|rb|go|rs|sql|xml|csv|yml|yaml)$/i;
    if (!allowed.test(file.name)) { setError("Filhal text aur code files supported hain."); return; }
    setAttachment({ name: file.name, content: await file.text() }); setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function startMic() {
    type RecognitionCtor = new () => { lang: string; interimResults: boolean; start(): void; onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onend: () => void; onerror: () => void };
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("Is browser mein voice input supported nahi hai."); return; }
    const recognition = new SpeechRecognition(); recognition.lang = "ur-PK"; recognition.interimResults = false;
    recognition.onresult = (event) => setInput((old) => `${old}${old ? " " : ""}${event.results[0][0].transcript}`);
    recognition.onend = () => setListening(false); recognition.onerror = () => { setListening(false); setError("Microphone sun nahi saka. Permission check karein."); };
    setListening(true); recognition.start();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); }
  }

  const activeTitle = chats.find((chat) => chat.id === activeId)?.title;
  return <div className="app-shell">
    {sidebarOpen && <button className="scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand-row"><div className="brand-mark"><Icon name="spark" size={18} /></div><strong>SHEHRYAR AI</strong><button className="icon-btn close-side" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><Icon name="close" /></button></div>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={`nav-item primary ${activeNav === "new" ? "is-selected" : ""}`} onClick={() => { setActiveNav("new"); void newChat(); }}><Icon name="plus" /><span>New Chat</span>{activeNav === "new" && <em className="selected-tag">Selected</em>}</button>
        <button className={`nav-item ${activeNav === "coding" ? "is-selected" : ""}`} onClick={() => { setActiveNav("coding"); void newChat("Build a complete, production-ready "); }}><Icon name="code" /><span>Coding Expert</span>{activeNav === "coding" && <em className="selected-tag">Selected</em>}</button>
        <button className={`nav-item ${activeNav === "saved" ? "is-selected" : ""}`} onClick={() => { setActiveNav("saved"); if (!user) { setAuthMode("login"); setAuthError(""); setAuthOpen(true); } }}><Icon name="bookmark" /><span>Saved Chats</span>{activeNav === "saved" && <em className="selected-tag">Selected</em>}</button>
        <a className={`nav-item ${activeNav === "youtube" ? "is-selected" : ""}`} href="https://www.youtube.com/@ShehryarVibes2/videos" target="_blank" rel="noreferrer" onClick={() => setActiveNav("youtube")}><Icon name="youtube" /><span>Visit YouTube Channel</span>{activeNav === "youtube" && <em className="selected-tag">Selected</em>}</a>
      </nav>
      <div className="history-label">Recent</div>
      <div className="history-list">
        {listLoading && <div className="history-empty">Loading chats…</div>}
        {!listLoading && !chats.length && <div className="history-empty">Your chats will appear here.</div>}
        {chats.map((chat) => <div className={`history-row ${activeId === chat.id ? "active" : ""}`} key={chat.id}><button onClick={() => { setActiveNav(null); void openChat(chat.id); }} title={chat.title}><span>{chat.title}</span>{activeId === chat.id && <em className="selected-tag">Selected</em>}</button><button className="delete-btn" onClick={() => void deleteChat(chat.id)} aria-label={`Delete ${chat.title}`}><Icon name="trash" size={16} /></button></div>)}
      </div>
      {user ? (
        <div className="sidebar-foot">
          <div className="avatar">{user.avatarIndex !== null ? <img src={avatarUrl(user.avatarIndex)} alt="" /> : user.name.charAt(0).toUpperCase()}</div>
          <div><strong>{user.name}</strong><span>{user.email}</span></div>
          <button className="logout-btn" onClick={() => void logout()}>Logout</button>
        </div>
      ) : (
        <div className="auth-buttons">
          <button className="auth-cta primary-cta" onClick={() => { setAuthMode("login"); setAuthError(""); setAuthOpen(true); }}>Login</button>
          <button className="auth-cta" onClick={() => { setAuthMode("signup"); setAuthError(""); setAuthOpen(true); }}>Sign Up</button>
        </div>
      )}
    </aside>

    {authOpen && (
      <div className="modal-scrim" role="dialog" aria-modal="true" aria-label={authMode === "login" ? "Login" : "Sign Up"}>
        <div className="auth-modal">
          <div className="auth-head">
            <strong>{authMode === "login" ? "Welcome back" : "Create your account"}</strong>
            <button className="icon-btn" onClick={() => setAuthOpen(false)} aria-label="Close"><Icon name="close" /></button>
          </div>
          <div className="auth-tabs" role="tablist">
            <button role="tab" aria-selected={authMode === "login"} className={authMode === "login" ? "active" : ""} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Login</button>
            <button role="tab" aria-selected={authMode === "signup"} className={authMode === "signup" ? "active" : ""} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Sign Up</button>
          </div>
          <p className="auth-hint">{authMode === "login" ? "Pehle se account hai? Email aur password se login karein." : "Naya account banayein — email aur password likhein."}</p>
          <form onSubmit={submitAuth} className="auth-form">

            <input type="email" placeholder="Email address" value={authForm.email} onChange={(event) => setAuthForm((old) => ({ ...old, email: event.target.value }))} required autoComplete="email" />
            <input type="password" placeholder="Password (min 6 characters)" value={authForm.password} onChange={(event) => setAuthForm((old) => ({ ...old, password: event.target.value }))} required minLength={6} maxLength={100} autoComplete={authMode === "signup" ? "new-password" : "current-password"} />
            {authError && <div className="auth-error">{authError}</div>}
            <button className="auth-submit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? "Login" : "Sign Up"}</button>
          </form>
          <p className="auth-switch">
            {authMode === "login" ? "Account nahi hai?" : "Pehle se account hai?"}{" "}
            <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); }}>
              {authMode === "login" ? "Sign Up" : "Login"}
            </button>
          </p>
        </div>
      </div>
    )}

    {pendingUser && (
      <div className="modal-scrim onboarding-scrim" role="dialog" aria-modal="true" aria-label="Complete your profile">
        <div className="onboarding-modal">
          {onboardingStep === 1 ? (
            <>
              <div className="onboarding-icon"><Icon name="spark" size={22} /></div>
              <div className="onboarding-kicker">Welcome to SHEHRYAR AI</div>
              <h2>Your name</h2>
              <p>Apna naam likhein, taake SHEHRYAR AI aapko yaad rakhe.</p>
              <input className="onboarding-input" autoFocus type="text" placeholder="Enter your name" value={onboardingName} onChange={(event) => setOnboardingName(event.target.value)} maxLength={60} />
              {onboardingError && <div className="auth-error">{onboardingError}</div>}
              <button className="auth-submit" disabled={onboardingName.trim().length < 2} onClick={() => { setOnboardingStep(2); setOnboardingError(""); }}>Next</button>
            </>
          ) : (
            <>
              <div className="onboarding-top"><div><div className="onboarding-kicker">Almost there</div><h2>Choose your photo</h2></div><button className="icon-btn" onClick={() => setOnboardingStep(1)} aria-label="Back"><span className="back-arrow">‹</span></button></div>
              <p>Apni pasand ki photo select karein.</p>
              <div className="photo-grid">{avatarOptions.map((photo) => <button key={photo.index} className={`photo-choice ${selectedAvatar === photo.index ? "selected" : ""}`} onClick={() => setSelectedAvatar(photo.index)} aria-label={photo.label}><img src={photo.src} alt="" loading="lazy" /></button>)}</div>
              {onboardingError && <div className="auth-error">{onboardingError}</div>}
              <button className="auth-submit" disabled={selectedAvatar === null || onboardingBusy} onClick={() => void finishOnboarding()}>{onboardingBusy ? "Saving…" : "Finish"}</button>
            </>
          )}
        </div>
      </div>
    )}

    <main className="chat-main">
      <header className="topbar"><button className="icon-btn menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Icon name="menu" /></button><div className="mobile-brand">SHEHRYAR AI</div>{activeTitle && <div className="chat-title">{activeTitle}</div>}<div className="status"><span />AI assistant</div></header>
      {!messages.length ? <section className="welcome"><div className="hero-logo"><Icon name="spark" size={28} /></div><h1>How can I help you today?</h1><p>Ask anything, build something, or solve a coding problem.</p><div className="suggestions"><button onClick={() => setInput("Build a modern responsive website for ")}><Icon name="code" /><span><strong>Build a website</strong><small>Complete responsive code</small></span></button><button onClick={() => setInput("Debug this code and explain the issue: ")}><Icon name="spark" /><span><strong>Debug my code</strong><small>Find and fix the problem</small></span></button></div></section> : <section className="messages" aria-live="polite">{messages.map((message) => <article className={`message ${message.role}`} key={message.id}><div className="message-avatar">{message.role === "assistant" ? <Icon name="spark" size={17} /> : "S"}</div><div className="message-body"><div className="message-name">{message.role === "assistant" ? "SHEHRYAR AI" : "You"}</div>{message.attachmentName && <div className="attachment-chip"><Icon name="paperclip" size={14} />{message.attachmentName}</div>}<RichText content={message.content} />{message.role === "assistant" && <CopyButton text={message.content} />}</div></article>)}{loading && messages[messages.length - 1]?.role !== "assistant" && <article className="message assistant reading-message"><div className="message-avatar"><Icon name="spark" size={17} /></div><div className="message-body"><div className="message-name">SHEHRYAR AI</div><div className="reading-status"><span>Reading</span><div className="thinking"><i /><i /><i /></div></div></div></article>}<div ref={bottomRef} /></section>}

      <div className="composer-wrap">{error && <div className="error-banner"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><Icon name="close" size={16} /></button></div>}{attachment && <div className="file-preview"><Icon name="paperclip" size={16} /><span>{attachment.name}</span><button onClick={() => setAttachment(null)} aria-label="Remove file"><Icon name="close" size={15} /></button></div>}<form className="composer" onSubmit={sendMessage}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder="Message SHEHRYAR AI" rows={1} disabled={loading} /><div className="composer-actions"><div><input ref={fileRef} type="file" hidden onChange={(event) => void onFile(event.target.files?.[0])} accept=".txt,.md,.js,.jsx,.ts,.tsx,.html,.css,.json,.py,.java,.c,.cpp,.cs,.php,.rb,.go,.rs,.sql,.xml,.csv,.yml,.yaml" /><button type="button" className="tool-btn" onClick={() => fileRef.current?.click()} aria-label="Attach file"><Icon name="paperclip" /></button><button type="button" className={`tool-btn ${listening ? "recording" : ""}`} onClick={startMic} aria-label="Voice input"><Icon name="mic" /></button></div>{loading ? <button type="button" className="send-btn" onClick={() => abortRef.current?.abort()} aria-label="Stop response"><Icon name="stop" size={18} /></button> : <button className="send-btn" disabled={!input.trim() && !attachment} aria-label="Send message"><Icon name="send" size={18} /></button>}</div></form><p className="disclaimer">SHEHRYAR AI can make mistakes. Check important information.</p></div>
    </main>
  </div>;
}
