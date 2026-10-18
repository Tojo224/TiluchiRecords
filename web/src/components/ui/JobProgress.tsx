export function JobProgress({
  label,
  progress,
}: {
  label: string;
  progress: number;
}) {
  const value = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div
      className="grid gap-2"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div className="flex items-center justify-between gap-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">
        <span>{label}</span>
        <span className="tabular-nums">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-500 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
