type SectionHeadingProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  compact?: boolean;
};

export function SectionHeading({
  icon,
  title,
  description,
  compact = false,
}: SectionHeadingProps) {
  return (
    <header
      className={`flex items-center gap-3 ${compact ? "" : "px-5 pb-4 pt-5"}`}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        {icon}
      </span>
      <span className="min-w-0">
        <h2 className="font-semibold text-zinc-950 dark:text-zinc-50">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </span>
    </header>
  );
}
