import {
  Files,
  FolderOpen,
  Gauge,
  Home,
  Menu,
  Mic2,
  Music2,
  User,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/navigation/Sidebar";
import { ThemeToggle } from "../components/ThemeToggle";

const routeMeta: Array<{ match: RegExp; title: string; icon: LucideIcon }> = [
  { match: /\/karaoke$/, title: "Karaoke", icon: Mic2 },
  { match: /\/face-swap$/, title: "Face swap", icon: Wand2 },
  { match: /\/music-video$/, title: "Video desde musica", icon: Music2 },
  { match: /\/files$/, title: "Archivos", icon: FolderOpen },
  { match: /\/results$/, title: "Resultados", icon: Files },
  { match: /\/projects\/[^/]+$/, title: "Resumen", icon: Gauge },
  { match: /\/projects$/, title: "Proyectos", icon: FolderOpen },
  { match: /\/profile$/, title: "Mi perfil", icon: User },
  { match: /\/dashboard$/, title: "Inicio", icon: Home },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const location = useLocation();
  const meta =
    routeMeta.find(({ match }) => match.test(location.pathname)) ||
    routeMeta[routeMeta.length - 1];
  const PageIcon = meta.icon;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-[#071014] dark:text-zinc-100 lg:flex">
      {sidebarVisible && (
        <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
          <Sidebar />
        </div>
      )}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="w-72" onClick={(event) => event.stopPropagation()}>
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-zinc-200 bg-white/95 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#081216]/95 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button
              className="grid size-10 shrink-0 place-items-center rounded-md text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={23} />
            </button>
            <button
              className="hidden size-10 shrink-0 place-items-center rounded-md text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white lg:grid"
              onClick={() => setSidebarVisible((current) => !current)}
              aria-label={sidebarVisible ? "Ocultar menu" : "Mostrar menu"}
              title={sidebarVisible ? "Ocultar menu" : "Mostrar menu"}
            >
              <Menu size={23} />
            </button>
            <span className="hidden h-7 w-px bg-zinc-200 dark:bg-white/10 sm:block" />
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              <PageIcon size={20} />
            </span>
            {location.pathname.endsWith("/karaoke") ? (
              <h1 className="truncate text-lg font-semibold tracking-normal">
                {meta.title}
              </h1>
            ) : (
              <strong className="truncate text-lg font-semibold tracking-normal">
                {meta.title}
              </strong>
            )}
          </div>
          <ThemeToggle />
        </header>
        <main className="mx-auto grid w-full max-w-[1480px] gap-6 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
