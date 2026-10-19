import {
  ChevronUp,
  Film,
  FolderOpen,
  Home,
  Images,
  LogOut,
  Mic2,
  Music2,
  User,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../app/providers/AuthProvider";
import { cn } from "../../shared/lib/format";

type NavItemProps = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  nested?: boolean;
  onNavigate?: () => void;
};

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  nested,
  onNavigate,
}: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
          nested && "ml-3",
          isActive
            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white",
        )
      }
    >
      <Icon size={19} strokeWidth={1.8} />
      <span>{label}</span>
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1];

  return (
    <aside className="flex h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white px-4 py-5 text-zinc-950 dark:border-white/10 dark:bg-[#061014] dark:text-white">
      <NavLink
        to="/dashboard"
        onClick={onNavigate}
        className="mb-8 flex items-center gap-3 px-1"
        aria-label="TiluchiRecords - Estudio creativo audiovisual"
      >
        <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-[#021116] shadow-lg shadow-emerald-500/15">
          <img
            src="/assets/Logo_TiluchiRecords.png"
            alt=""
            className="pointer-events-none size-full select-none object-contain"
          />
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-base font-bold">
            TiluchiRecords
          </strong>
          <small className="text-xs text-zinc-500 dark:text-zinc-400">
            Estudio creativo audiovisual
          </small>
        </span>
      </NavLink>

      <nav className="grid gap-1" aria-label="Navegacion principal">
        <NavItem
          to="/dashboard"
          label="Inicio"
          icon={Home}
          onNavigate={onNavigate}
        />
        <NavLink
          to="/projects"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "mt-1 flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors",
              isActive
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/[0.06]",
            )
          }
        >
          <FolderOpen size={20} strokeWidth={1.8} />
          <span>Proyectos</span>
          {projectId && <ChevronUp className="ml-auto" size={16} />}
        </NavLink>

        {projectId && (
          <div className="ml-3 grid gap-1 border-l border-zinc-300 py-2 pl-1 dark:border-zinc-600">
            <NavItem
              to={`/projects/${projectId}`}
              label="Resumen"
              icon={Film}
              end
              nested
              onNavigate={onNavigate}
            />
            <NavItem
              to={`/projects/${projectId}/karaoke`}
              label="Karaoke"
              icon={Mic2}
              nested
              onNavigate={onNavigate}
            />
            <NavItem
              to={`/projects/${projectId}/face-swap`}
              label="Face swap"
              icon={Wand2}
              nested
              onNavigate={onNavigate}
            />
            <NavItem
              to={`/projects/${projectId}/music-video`}
              label="Video desde musica"
              icon={Music2}
              nested
              onNavigate={onNavigate}
            />
            <NavItem
              to={`/projects/${projectId}/files`}
              label="Archivos"
              icon={FolderOpen}
              nested
              onNavigate={onNavigate}
            />
            <NavItem
              to={`/projects/${projectId}/results`}
              label="Resultados"
              icon={Images}
              nested
              onNavigate={onNavigate}
            />
          </div>
        )}

        <div className="my-3 border-t border-zinc-200 dark:border-white/10" />
        <NavItem
          to="/profile"
          label="Mi perfil"
          icon={User}
          onNavigate={onNavigate}
        />
      </nav>

      <div className="mt-auto border-t border-zinc-200 pt-5 dark:border-white/10">
        <div className="mb-3 flex min-w-0 items-center gap-3 px-1">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white shadow-md shadow-emerald-600/20">
            {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm">
              {user?.name || "Usuario"}
            </strong>
            <small className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              {user?.email}
            </small>
          </span>
        </div>
        <button
          onClick={logout}
          className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          <LogOut size={19} />
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
}
