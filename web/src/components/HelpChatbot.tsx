import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Bot,
  ChevronRight,
  Files,
  FolderOpen,
  Loader2,
  MessageCircle,
  Mic2,
  Music2,
  Send,
  UserRound,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";

type Destination = "KARAOKE" | "FACE_SWAP" | "MUSIC_VIDEO" | "FILES" | "RESULTS" | "PROJECTS" | "NONE";
type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  destination?: Destination;
};
type DestinationOption = {
  id: Exclude<Destination, "NONE">;
  label: string;
  icon: LucideIcon;
};
type ChatResponse = { reply: string; destination: Destination };

const options: DestinationOption[] = [
  { id: "KARAOKE", label: "Karaoke", icon: Mic2 },
  { id: "FACE_SWAP", label: "Face swap", icon: Wand2 },
  { id: "MUSIC_VIDEO", label: "Video desde música", icon: Music2 },
  { id: "FILES", label: "Archivos", icon: FolderOpen },
  { id: "RESULTS", label: "Resultados", icon: Files },
  { id: "PROJECTS", label: "Proyectos", icon: UserRound },
];

export function HelpChatbot() {
  const { api } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "assistant",
      content: "¡Hola! Soy el asistente de TiluchiRecords. ¿Qué quieres crear o resolver?",
    },
  ]);
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const projectMatch = location.pathname.match(/\/projects\/([^/]+)/);
  const projectBase = projectMatch ? `/projects/${projectMatch[1]}` : null;

  useEffect(() => {
    if (open) inputRef.current?.focus();
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, loading]);

  function pathFor(destination: Exclude<Destination, "NONE">) {
    if (destination === "PROJECTS") return "/projects";
    if (!projectBase) return "/projects";
    const suffix: Record<Exclude<Destination, "NONE" | "PROJECTS">, string> = {
      KARAOKE: "karaoke",
      FACE_SWAP: "face-swap",
      MUSIC_VIDEO: "music-video",
      FILES: "files",
      RESULTS: "results",
    };
    return `${projectBase}/${suffix[destination]}`;
  }

  function goTo(destination: Exclude<Destination, "NONE">) {
    setOpen(false);
    setInput("");
    setError("");
    navigate(pathFor(destination));
  }

  async function sendMessage(value = input) {
    const content = value.trim();
    if (!content || loading) return;
    const userMessage: ChatMessage = { id: Date.now(), role: "user", content };
    const history = messages.slice(-10).map(({ role, content: text }) => ({
      role,
      content: text,
    }));
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const response = await api<ChatResponse>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ message: content, history }),
      });
      const validDestination = options.some((option) => option.id === response.destination)
        ? response.destination
        : "NONE";
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: response.reply,
          destination: validDestination,
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No pude conectar con el asistente. Inténtalo de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section
          aria-label="Chat de ayuda"
          className="flex h-[520px] max-h-[calc(100dvh-120px)] w-[min(390px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-950/20 dark:border-white/10 dark:bg-[#0b171b] dark:shadow-black/50"
        >
          <header className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <Bot size={21} />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Asistente TiluchiRecords</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">En línea para ayudarte</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-white/10"
              aria-label="Cerrar asistente"
            >
              <X size={19} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" aria-busy={loading}>
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-md bg-emerald-600 text-white dark:bg-emerald-500 dark:text-zinc-950"
                      : "rounded-bl-md bg-zinc-100 text-zinc-800 dark:bg-white/[0.07] dark:text-zinc-100"
                  }`}
                >
                  <p>{message.content}</p>
                  {message.destination && message.destination !== "NONE" && (
                    <button
                      onClick={() => goTo(message.destination as Exclude<Destination, "NONE">)}
                      className="mt-2 inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                    >
                      {projectBase || message.destination === "PROJECTS"
                        ? `Abrir ${options.find((option) => option.id === message.destination)?.label}`
                        : "Seleccionar proyecto"}
                      <ChevronRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start" role="status">
                <p className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-300">
                  <Loader2 size={16} className="animate-spin" />Pensando…
                </p>
              </div>
            )}
            {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-200">{error}</p>}
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {options.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => goTo(id)}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs text-zinc-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-white/10 dark:text-zinc-300 dark:hover:text-emerald-300"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-white/10">
            <label className="sr-only" htmlFor="help-chat-input">Escribe tu mensaje</label>
            <input
              ref={inputRef}
              id="help-chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escribe tu mensaje…"
              className="min-w-0 flex-1 rounded-xl"
              maxLength={1500}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Enviar mensaje"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:opacity-40 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
            >
              <Send size={17} />
            </button>
          </form>
        </section>
      )}
      <button
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente de ayuda"}
        aria-expanded={open}
        className="grid size-14 place-items-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-950/25 transition hover:scale-105 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
      >
        {open ? <X size={23} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
