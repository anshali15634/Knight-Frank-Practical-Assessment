"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Brain, Send, Settings, X, Zap } from "lucide-react";
import FrankBlob, { type Gaze } from "@/components/assistant/Frankblob";
import "./frank-assistant.css";

type Source = { source: string; url?: string | null; snippet?: string | null };
type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
};
type ProgressStage = "analyzing" | "research" | "generating";
type ProgressStep = {
  stage: ProgressStage;
  message: string;
  startedAt: number;
  durationSeconds?: number;
};
type AgentEventData = {
  stage?: unknown;
  message?: unknown;
  answer?: unknown;
  session_id?: unknown;
  sources?: unknown;
};

const GREETING =
  "Hi, I'm Frank, your Knight Frank property investment assistant. How may I help you today?";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/+$/, "");

function isSource(value: unknown): value is Source {
  return (
    typeof value === "object" &&
    value !== null &&
    "source" in value &&
    typeof value.source === "string"
  );
}

async function readAgentEvents(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: AgentEventData) => void
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function dispatch(block: string) {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (data.length > 0) onEvent(event, JSON.parse(data.join("\n")) as AgentEventData);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer)) !== null) {
        dispatch(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
      }
      if (done) break;
    }
    if (buffer.trim()) dispatch(buffer);
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
}

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
  const [loading, setLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [progressTime, setProgressTime] = useState(0);

  const nextId = useRef(1);
  const sessionId = useRef<string | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) return;
    const interval = window.setInterval(() => setProgressTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    return () => {
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
  }, [messages, loading, progressSteps]);

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

  function addMessage(role: Message["role"], text: string, sources?: Source[]) {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { id, role, text, sources }]);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.target.value);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;

    addMessage("user", text);
    setDraft("");
    setLoading(true);
    setProgressTime(Date.now());
    setProgressSteps([
      {
        stage: "analyzing",
        message: "Reviewing your question...",
        startedAt: Date.now(),
      },
    ]);

    try {
      const response = await fetch(`${API_URL}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId.current,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { detail?: unknown }
          | null;
        throw new Error(
          typeof body?.detail === "string"
            ? body.detail
            : `Frank's service returned an error (${response.status}).`
        );
      }
      if (!response.body) throw new Error("Frank's response stream was unavailable.");

      let receivedAnswer = false;
      await readAgentEvents(response.body, (event, data) => {
        if (event === "progress" && typeof data.message === "string") {
          const message = data.message;
          const stage: ProgressStage =
            data.stage === "research" || data.stage === "generating"
              ? data.stage
              : "analyzing";
          const now = Date.now();
          setProgressSteps((steps) => {
            const current = steps.at(-1);
            if (current?.stage === stage && current.message === message) {
              return steps;
            }
            return [
              ...steps.map((step, index) =>
                index === steps.length - 1 &&
                step.durationSeconds === undefined
                  ? {
                      ...step,
                      durationSeconds: Math.max(
                        1,
                        Math.floor((now - step.startedAt) / 1000)
                      ),
                    }
                  : step
              ),
              { stage, message, startedAt: now },
            ];
          });
          return;
        }
        if (event === "error") {
          throw new Error(
            typeof data.message === "string"
              ? data.message
              : "Frank couldn't complete that request. Please try again."
          );
        }
        if (event === "complete") {
          if (typeof data.answer !== "string" || typeof data.session_id !== "string") {
            throw new Error("Frank returned an invalid response. Please try again.");
          }
          sessionId.current = data.session_id;
          const sources = Array.isArray(data.sources)
            ? data.sources.filter(isSource)
            : [];
          addMessage("assistant", data.answer, sources);
          receivedAnswer = true;
        }
      });
      if (!receivedAnswer) throw new Error("Frank's response ended unexpectedly. Please try again.");
    } catch (error) {
      addMessage(
        "assistant",
        error instanceof Error
          ? error.message
          : "Frank couldn't complete that request. Please try again."
      );
    } finally {
      setLoading(false);
      setProgressSteps([]);
    }
  }

  function progressIcon(stage: ProgressStage) {
    const Icon =
      stage === "analyzing" ? Brain : stage === "research" ? Settings : Zap;
    return <Icon size={20} strokeWidth={2} aria-hidden="true" />;
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
                <div className="frank-msg__bubble">
                  <p>{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <ul className="frank-sources" aria-label="Sources">
                      {m.sources.map((source, index) => (
                        <li key={`${source.source}-${index}`}>
                          {source.url ? (
                            <a href={source.url} target="_blank" rel="noreferrer">
                              {source.source}
                            </a>
                          ) : (
                            source.source
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
            {loading && (
              <li className="frank-msg frank-msg--assistant frank-msg--enter">
                {avatar}
                <div className="frank-msg__bubble frank-progress">
                  <ol className="frank-progress__steps" aria-label="Frank's progress">
                    {progressSteps.map((step, index) => {
                      const isCurrent = index === progressSteps.length - 1;
                      const elapsedSeconds =
                        step.durationSeconds ??
                        Math.max(
                          1,
                          Math.floor((progressTime - step.startedAt) / 1000)
                        );
                      return (
                        <li
                          className="frank-progress__step"
                          key={`${step.stage}-${index}`}
                          aria-current={isCurrent ? "step" : undefined}
                        >
                          <span className="frank-progress__icon">
                            {progressIcon(step.stage)}
                          </span>
                          <span className="frank-progress__copy">
                            <span
                              className="frank-progress__label"
                              aria-live={isCurrent ? "polite" : undefined}
                            >
                              {step.message}
                            </span>
                            <span className="frank-progress__duration">
                              {elapsedSeconds}s
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
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
          <button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim() || loading}
          >
            <Send size={18} />
          </button>
        </form>
      </aside>
    </>
  );
}