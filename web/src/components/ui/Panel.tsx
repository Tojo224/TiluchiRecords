import { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../shared/lib/format";

export function Panel({
  title,
  actions,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { title?: string; actions?: ReactNode }) {
  return (
    <section
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0b171c] dark:shadow-black/20",
        className,
      )}
      {...props}
    >
      {(title || actions) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {title}
            </h2>
          )}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
