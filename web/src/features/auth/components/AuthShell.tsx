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
    <main className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-[#071014] dark:text-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(460px,0.92fr)]">
        <section
          className="relative hidden min-h-screen overflow-hidden border-r border-zinc-200 dark:border-white/10 lg:block"
          aria-hidden="true"
        >
          <div
            className="absolute inset-0 bg-cover bg-center dark:hidden"
            style={{
              backgroundImage: "url('/assets/auth-studio-dark.jpg')",
              filter: "brightness(1.45) contrast(0.78) saturate(0.62)",
            }}
          />
          <div
            className="absolute inset-0 hidden bg-cover bg-center dark:block"
            style={{
              backgroundImage: "url('/assets/auth-studio-dark.jpg')",
            }}
          />
          <div className="absolute inset-0 bg-white/15 dark:hidden" />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent dark:from-[#061014] dark:via-[#061014]/10" />
          <div className="absolute inset-x-0 bottom-0 p-10 xl:p-14">
            <div className="max-w-xl border-l-2 border-emerald-500 pl-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
                Estudio creativo audiovisual
              </p>
              <p className="mt-3 text-3xl font-semibold leading-tight text-zinc-950 dark:text-white xl:text-4xl">
                Tu musica, tus historias y tu vision en un solo espacio.
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-5 py-20 sm:px-10 lg:px-12 xl:px-20">
          <div className="absolute right-5 top-5 sm:right-8 sm:top-7">
            <ThemeToggle />
          </div>
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-4">
              <span className="size-16 shrink-0 overflow-hidden rounded-md bg-[#021116] shadow-lg shadow-emerald-500/15">
                <img
                  src="/assets/Logo_TiluchiRecords.png"
                  alt=""
                  className="size-full object-contain"
                />
              </span>
              <span className="min-w-0">
                <strong className="block text-xl font-bold">
                  TiluchiRecords
                </strong>
                <small className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">
                  Estudio creativo audiovisual
                </small>
              </span>
            </div>

            <div className="mb-7">
              <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
            </div>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
