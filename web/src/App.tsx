import React from 'react';
import { Music, Mic, UserCheck, Video, Play, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';

export default function App() {
  const modules = [
    {
      id: 'karaoke',
      title: '1. Karaoke & Separación',
      desc: 'Extracción de pista instrumental y stems vocales con Demucs.',
      icon: Music,
      color: 'from-blue-500 to-indigo-600',
      badge: 'Sprint 1',
    },
    {
      id: 'recording',
      title: '2. Grabación & Mezcla',
      desc: 'Grabación de toma vocal sincronizada y mezcla con volúmenes en FFmpeg.',
      icon: Mic,
      color: 'from-amber-500 to-red-600',
      badge: 'Sprint 2',
    },
    {
      id: 'faceswap',
      title: '3. Face Swap',
      desc: 'Reemplazo facial de alta fidelidad con preservación de audio y auditoría de consentimiento.',
      icon: UserCheck,
      color: 'from-emerald-500 to-teal-600',
      badge: 'Sprint 2-3',
    },
    {
      id: 'videoclip',
      title: '4. Videoclip IA',
      desc: 'Análisis rítmico con librosa, generación de storyboard con LLM y composición de clips.',
      icon: Video,
      color: 'from-purple-500 to-pink-600',
      badge: 'Sprint 3-4',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center font-black text-xl shadow-lg shadow-red-500/20">
            T
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">TiluchiRecords</h1>
            <p className="text-xs text-slate-400">Plataforma Audiovisual Inteligente</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Cpu className="w-3.5 h-3.5" />
            <span>Arquitectura R-1 Lista</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Scrum v3.0</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 flex flex-col gap-10">
        <section className="text-center max-w-2xl mx-auto flex flex-col gap-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Producción Musical y Audiovisual con IA
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Monorepo unificado: Backend en NestJS con Prisma, Workers de IA desacoplados en Python y cliente web responsivo.
          </p>
        </section>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.id}
                className="group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-slate-700 hover:bg-slate-900 transition-all duration-300 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${m.color} text-white shadow-md`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      {m.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mb-2 group-hover:text-red-400 transition-colors">
                    {m.title}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {m.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-slate-500" /> Pipeline desacoplado
                  </span>
                  <span className="flex items-center gap-1 font-medium text-slate-300 group-hover:translate-x-0.5 transition-transform">
                    Ver módulo <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        TiluchiRecords — Scrum v3.0 (2 Desarrolladores / 4 Sprints / 8 Semanas)
      </footer>
    </div>
  );
}
