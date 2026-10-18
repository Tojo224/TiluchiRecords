import { ReactNode } from "react";
import { ThemeToggle } from "../../../components/ThemeToggle";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 p-4 dark:bg-zinc-950">
      <div className="fixed right-4 top-4">
        <ThemeToggle />
      </div>
      <section className="w-full max-w-md border border-zinc-200 bg-white p-7 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-md bg-red-600 text-lg font-black text-white">
            T
          </span>
          <div>
            <strong className="block text-zinc-950 dark:text-white">
              TiluchiRecords
            </strong>
            <span className="text-xs text-zinc-500">Estudio creativo</span>
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-zinc-950 dark:text-white">
          {title}
        </h1>
        <p className="mb-6 mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
        {children}
      </section>
    </main>
  );
}
