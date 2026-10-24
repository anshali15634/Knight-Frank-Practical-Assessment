"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Brain, Send, Settings, X, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FrankBlob from "@/components/assistant/Frankblob";
import "./frank-assistant.css";

type Source = { source: string; url?: string | null; snippet?: string | null };
type PropertyResult = {
  property_id: string;
  property_name: string | null;
  city: string | null;
  country: string | null;
  price_guide_price: number | null;
  currency: string | null;
  niy_yield: number | null;
};
type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  properties?: PropertyResult[];
  contactUrl?: string;
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
  intent?: unknown;
  contact_url?: unknown;
  sources?: unknown;
  properties?: unknown;
};

const GREETING =
  "Hi, I'm Frank, your Knight Frank property investment assistant. How may I help you today?";

const SUGGESTIONS = [
  "Show me retail properties in Africa yielding above 6.5%",
  "Did Dubai's villa sales go up this year?",
  "I want to contact an advisor.",
  "Show me the latest press release.",
  "What core districts account for Dubai's future office supply?",
];

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

function isPropertyResult(value: unknown): value is PropertyResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "property_id" in value &&
    typeof value.property_id === "string" &&
    "property_name" in value &&
    (typeof value.property_name === "string" || value.property_name === null) &&
    "city" in value &&
    (typeof value.city === "string" || value.city === null) &&
    "country" in value &&
    (typeof value.country === "string" || value.country === null) &&
    "price_guide_price" in value &&
    (typeof value.price_guide_price === "number" || value.price_guide_price === null) &&
    "currency" in value &&
    (typeof value.currency === "string" || value.currency === null) &&
    "niy_yield" in value &&
    (typeof value.niy_yield === "number" || value.niy_yield === null)
  );
}

function formatPropertyPrice(property: PropertyResult) {
  if (property.price_guide_price === null) return null;
  const currency = property.currency || "AED";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(property.price_guide_price);
  } catch {
    return `${currency} ${property.price_guide_price.toLocaleString("en")}`;
  }
}

function normalizedUrl(url: string) {
  try {
    return new URL(url, "https://www.knightfrank.ae").href;
  } catch {
    return url;
  }
}

function isWebUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function uniqueSources(sources: Source[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source.url) return true;
    const url = normalizedUrl(source.url);
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

function MessageBubble({
  message,
}: {
  message: Message;
}) {
  const seenLinks = new Set<string>();

  return (
    <li className={`frank-msg frank-msg--${message.role} frank-msg--enter`}>
      <div className="frank-msg__bubble">
        {message.role === "assistant" ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a({ href, children }) {
                if (!href) return <>{children}</>;
                const normalized = normalizedUrl(href);
                if (seenLinks.has(normalized)) return null;
                seenLinks.add(normalized);
                return (
                  <a href={href} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                );
              },
            }}
          >
            {message.text}
          </ReactMarkdown>
        ) : (
          <p>{message.text}</p>
        )}
        {message.contactUrl && (
          <p>
            <a href={message.contactUrl} target="_blank" rel="noreferrer">
              {message.contactUrl}
            </a>
          </p>
        )}
        {message.sources && message.sources.length > 0 && (
          <ul className="frank-sources" aria-label="Sources">
            {message.sources.map((source, index) => (
              <li key={source.url ?? `${source.source}-${index}`}>
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
        {message.properties && message.properties.length > 0 && (
          <div className="frank-properties" aria-label="Matching properties">
            {message.properties.map((property) => {
              const location = [property.city, property.country]
                .filter(Boolean)
                .join(", ");
              const price = formatPropertyPrice(property);
              return (
                <article className="frank-property" key={property.property_id}>
                  <h3>{property.property_name || "Property listing"}</h3>
                  {location && <p>{location}</p>}
                  {(price || property.niy_yield !== null) && (
                    <p className="frank-property__metrics">
                      {price && <span>{price}</span>}
                      {property.niy_yield !== null && (
                        <span>NIY {property.niy_yield}%</span>
                      )}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </li>
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

export default function FrankAssistant() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [progressTime, setProgressTime] = useState(0);

  const nextId = useRef(1);
  const sessionId = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) return;
    const interval = window.setInterval(() => setProgressTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [loading]);

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

  function handleToggle() {
    if (!open) setHasOpened(true);
    setOpen((o) => !o);
  }

  function addMessage(
    role: Message["role"],
    text: string,
    sources?: Source[],
    properties?: PropertyResult[],
    contactUrl?: string,
  ) {
    const id = nextId.current++;
    setMessages((prev) => [
      ...prev,
      { id, role, text, sources, properties, contactUrl },
    ]);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setDraft(event.target.value);
  }

  async function handleSubmit(eventOrText: FormEvent<HTMLFormElement> | string) {
    let text: string;
    if (typeof eventOrText === "string") {
      text = eventOrText.trim();
    } else {
      eventOrText.preventDefault();
      text = draft.trim();
    }
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
            ? uniqueSources(data.sources.filter(isSource))
            : [];
          const properties = Array.isArray(data.properties)
            ? data.properties.filter(isPropertyResult)
            : [];
          const contactUrl =
            data.intent === "contact" && isWebUrl(data.contact_url)
              ? data.contact_url
              : undefined;
          addMessage("assistant", data.answer, sources, properties, contactUrl);
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

  return (
    <>
      <button
        type="button"
        className={`frank-launcher${open ? " is-hidden" : ""}`}
        aria-expanded={open}
        aria-hidden={open}
        inert={open}
        aria-label={
          open
            ? "Close chat with Frank"
            : "Chat with Frank, your real estate assistant"
        }
        onClick={handleToggle}
      >
        <FrankBlob size={60} />
      </button>

      <aside
        className={`frank-panel${open ? " is-open" : ""}`}
        role="dialog"
        aria-label="Knight Frank AI assistant"
        aria-hidden={!open}
        inert={!open}
      >
        <header className="frank-panel__header">
          <div>
            <p className="frank-panel__title">Knight Frank AI</p>
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
                <p className="frank-msg__bubble">{GREETING}</p>
              </li>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {loading && (
              <li className="frank-msg frank-msg--assistant frank-msg--enter">
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
          {messages.length === 0 && hasOpened && (
            <div className="frank-suggestions" role="group" aria-label="Suggested questions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  className="frank-suggestions__pill"
                  key={suggestion}
                  type="button"
                  onClick={() => void handleSubmit(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
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