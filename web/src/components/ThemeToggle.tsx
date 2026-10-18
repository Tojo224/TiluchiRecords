import { Moon, Sun } from "lucide-react";
import { useTheme } from "../app/providers/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      title={dark ? "Usar tema claro" : "Usar tema oscuro"}
      aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"}
      aria-pressed={dark}
      className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2 text-zinc-500 shadow-sm transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-[#0b171c] dark:text-zinc-400 dark:hover:border-white/20"
    >
      <Sun size={16} className={dark ? "text-zinc-500" : "text-amber-500"} />
      <span
        className="relative h-6 w-11 shrink-0 rounded-full bg-zinc-200 transition-colors dark:bg-emerald-500"
        aria-hidden="true"
      >
        <span
          className={`absolute left-1 top-1 size-4 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ${dark ? "translate-x-5" : "translate-x-0"}`}
        />
      </span>
      <Moon size={16} className={dark ? "text-sky-300" : "text-zinc-400"} />
    </button>
  );
}
