"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Send, X } from "lucide-react";
import FrankBlob, { type Gaze } from "@/components/assistant/Frankblob";
import "./frank-assistant.css";

type Message = { id: number; role: "user" | "assistant"; text: string };

const GREETING =
  "Hi, I'm Frank, your Knight Frank property investment assistant. How may I help you today?";

const STATIC_REPLY =
  "Thank you for your message. I'm still being set up, so I can't search live listings just yet. Soon I'll be able to help with markets, asset types and budgets. In the meantime, the search form on this page is a good place to start.";

/** What Frank does while nobody is interacting with him */
const IDLE_SEQUENCE: Gaze[] = ["up", "right", "down", "left"];
const IDLE_STEP_MS = 2000;
/** How long Frank takes to settle on "straight" before blinking on hover */
const HOVER_BLINK_DELAY_MS = 1000;

export default function FrankAssistant() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [blink, setBlink] = useState(false);
  const [idleIndex, setIdleIndex] = useState(0);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);

  const nextId = useRef(1);
  const timers = useRef<number[]>([]);
  const hoverTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => window.clearTimeout(t));
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    };
  }, []);

  // Idle: look up, to the side, down... until something happens
  useEffect(() => {
    if (open || hovered) return;
    const id = window.setInterval(
      () => setIdleIndex((i) => (i + 1) % IDLE_SEQUENCE.length),
      IDLE_STEP_MS
    );
    return () => window.clearInterval(id);
  }, [open, hovered]);

  // Focus the input once the pop-out has appeared
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 350);
    return () => window.clearTimeout(t);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Keep the newest message in view
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  // Open -> looks up. Typing -> looks down curiously. Otherwise hover/idle.
  const gaze: Gaze = open
    ? draft.trim()
      ? "down"
      : "up"
    : hovered
      ? "center"
      : IDLE_SEQUENCE[idleIndex];

  function handleHoverStart() {
    setHovered(true);
    if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(
      () => setBlink(true),
      HOVER_BLINK_DELAY_MS
    );
  }

  function handleHoverEnd() {
    setHovered(false);
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }

  function handleToggle() {
    if (!open) setHasOpened(true);
    handleHoverEnd();
    setOpen((o) => !o);
  }

  function addMessage(role: Message["role"], text: string) {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { id, role, text }]);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.target.value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    addMessage("user", text);
    setDraft("");
    setTyping(true);

    // Frank glances back up and blinks as he "reads" the message
    later(() => setBlink(true), 1200);
    later(() => {
      setTyping(false);
      addMessage("assistant", STATIC_REPLY);
    }, 1400);
  }

  const avatar = <FrankBlob size={36} isStatic className="frank-avatar" />;

  return (
    <>
      <button
        type="button"
        className="frank-launcher"
        aria-expanded={open}
        aria-label={
          open
            ? "Close chat with Frank"
            : "Chat with Frank, your real estate assistant"
        }
        onMouseEnter={handleHoverStart}
        onMouseLeave={handleHoverEnd}
        onClick={handleToggle}
      >
        <FrankBlob
          size={76}
          gaze={gaze}
          blink={blink}
          onBlinkEnd={() => setBlink(false)}
        />
      </button>

      <aside
        className={`frank-panel${open ? " is-open" : ""}`}
        role="dialog"
        aria-label="Frank, Knight Frank AI assistant"
        aria-hidden={!open}
        inert={!open}
      >
        <header className="frank-panel__header">
          <div>
            <p className="frank-panel__name">Frank</p>
            <p className="frank-panel__role">Knight Frank AI assistant</p>
          </div>
          <button
            type="button"
            className="frank-panel__close"
            aria-label="Close assistant"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </header>

        <div className="frank-panel__body" ref={scrollRef}>
          <ol className="frank-messages" aria-live="polite">
            {hasOpened && (
              <li className="frank-msg frank-msg--assistant frank-msg--greet">
                {avatar}
                <p className="frank-msg__bubble">{GREETING}</p>
              </li>
            )}
            {messages.map((m) => (
              <li
                key={m.id}
                className={`frank-msg frank-msg--${m.role} frank-msg--enter`}
              >
                {m.role === "assistant" && avatar}
                <p className="frank-msg__bubble">{m.text}</p>
              </li>
            ))}
            {typing && (
              <li className="frank-msg frank-msg--assistant frank-msg--enter">
                {avatar}
                <p
                  className="frank-msg__bubble frank-typing"
                  aria-label="Frank is typing"
                >
                  <span />
                  <span />
                  <span />
                </p>
              </li>
            )}
          </ol>
        </div>

        <form className="frank-panel__form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={handleChange}
            placeholder="Ask about markets, assets or budgets"
            aria-label="Message Frank"
            autoComplete="off"
          />
          <button type="submit" aria-label="Send message" disabled={!draft.trim()}>
            <Send size={18} />
          </button>
        </form>
      </aside>
    </>
  );
}