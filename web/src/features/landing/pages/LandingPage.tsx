import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  Mic,
  Music,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Video,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { ThemeToggle } from "../../../components/ThemeToggle";

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const modules = [
    {
      id: "karaoke",
      title: "1. Karaoke & Separación",
      desc: "Extracción de pista instrumental y stems vocales con Demucs v4. Sincronización lírica y modo cantar en vivo.",
      icon: Music,
      color: "from-blue-500 to-indigo-600",
      badge: "Sprint 1",
      path: "/projects",
    },
    {
      id: "recording",
      title: "2. Grabación & Mezcla",
      desc: "Grabación de toma vocal sincronizada, pre-escucha y mezcla multipista de alta fidelidad con FFmpeg.",
      icon: Mic,
      color: "from-amber-500 to-red-600",
      badge: "Sprint 2",
      path: "/projects",
    },
    {
      id: "faceswap",
      title: "3. Face Swap",
      desc: "Reemplazo facial de alta fidelidad con InsightFace, preservación de pista de audio y auditoría de consentimiento legal.",
      icon: UserCheck,
      color: "from-emerald-500 to-teal-600",
      badge: "Sprint 2-3",
      path: "/projects",
    },
    {
      id: "videoclip",
      title: "4. Videoclip IA",
      desc: "Análisis rítmico automatizado con Librosa (BPM, beats), generación de storyboard y composición de clips.",
      icon: Video,
      color: "from-purple-500 to-pink-600",
      badge: "Sprint 3-4",
      path: "/projects",
    },
  ];

  function handleModuleClick(targetPath: string) {
    if (user) {
      navigate(targetPath);
    } else {
      navigate("/login", { state: { from: targetPath } });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 font-black text-xl text-white shadow-lg shadow-emerald-500/25 transition-transform group-hover:scale-105">
              T
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight text-white">
                TiluchiRecords
              </h1>
              <p className="text-xs text-slate-400">
                Plataforma Audiovisual Inteligente
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden md:flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                <Cpu className="size-3.5" />
                <span>Arquitectura R-1 Lista</span>
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
                <ShieldCheck className="size-3.5" />
                <span>Scrum v3.0</span>
              </span>
            </div>

            <ThemeToggle />

            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-xs font-medium text-slate-300">
                  {user.name}
                </span>
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-emerald-500/20 transition hover:bg-emerald-400"
                >
                  Ir al Dashboard
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  to="/login"
                  className="rounded-lg border border-slate-700 bg-slate-900/80 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 shadow-md shadow-emerald-500/20 transition hover:bg-emerald-400"
                >
                  Crear Cuenta
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 py-12 md:py-16">
        <section className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
            <Sparkles className="size-4 animate-pulse" />
            <span>Ingeniería de Software I · UAGRM 2-2026</span>
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Producción Musical y{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Audiovisual con IA
            </span>
          </h2>

          <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">
            Plataforma unificada de producción multimedia: Backend desacoplado en
            NestJS, procesamiento asíncrono con Redis y Workers de IA en Python
            (Demucs, InsightFace, Librosa) con almacenamiento distribuido S3 en MinIO.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => handleModuleClick("/projects")}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:brightness-110 active:scale-95"
            >
              Comenzar a Crear
              <ArrowRight className="size-4" />
            </button>
            <Link
              to={user ? "/dashboard" : "/login"}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            >
              <Layers className="size-4 text-slate-400" />
              {user ? "Panel Principal" : "Acceso Creadores"}
            </Link>
          </div>
        </section>

        {/* Modules Grid */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Módulos del Sistema</h3>
              <p className="text-xs text-slate-400">
                Haz clic en cualquier módulo para ingresar a su área de trabajo.
              </p>
            </div>
            <span className="text-xs font-medium text-emerald-400">
              4 Módulos Operativos
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.id}
                  onClick={() => handleModuleClick(m.path)}
                  className="group relative flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-800/90 bg-slate-900/50 p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-700 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-emerald-500/5"
                >
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div
                        className={`flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${m.color} text-white shadow-md`}
                      >
                        <Icon className="size-6" />
                      </div>
                      <span className="rounded-md border border-slate-700 bg-slate-800/90 px-2.5 py-1 text-xs font-semibold text-slate-300">
                        {m.badge}
                      </span>
                    </div>
                    <h4 className="mb-2 text-lg font-bold text-white transition-colors group-hover:text-emerald-400">
                      {m.title}
                    </h4>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {m.desc}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-400/90">
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                      Pipeline desacoplado
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-slate-200 transition-transform group-hover:translate-x-1 group-hover:text-emerald-300">
                      Ver módulo <ArrowRight className="size-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Technical Architecture Highlight */}
        <section className="rounded-2xl border border-slate-800/90 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-950 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Arquitectura de Producción
              </span>
              <h3 className="mt-1 text-2xl font-bold text-white">
                Infraestructura Escalable en Microservicios
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Diseñado para soportar alta concurrencia en renderizado de audio y
                video. Base de datos PostgreSQL con migraciones automáticas Prisma, colas
                de mensajería Redis BullMQ, storage S3 en MinIO y workers aislados con
                aceleración por hardware.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-mono">
              <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-slate-300">
                NestJS 10
              </span>
              <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-slate-300">
                Prisma ORM
              </span>
              <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-slate-300">
                PostgreSQL 16
              </span>
              <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-slate-300">
                Redis 7
              </span>
              <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-slate-300">
                MinIO S3
              </span>
              <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-slate-300">
                Python Demucs/InsightFace
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        TiluchiRecords — Scrum v3.0 (2 Desarrolladores / 4 Sprints / 8 Semanas | UAGRM)
      </footer>
    </div>
  );
}
