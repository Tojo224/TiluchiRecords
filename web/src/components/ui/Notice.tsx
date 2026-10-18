import { cn } from "../../shared/lib/format";

export function Notice({
  message,
  tone = "info",
}: {
  message?: string;
  tone?: "info" | "success" | "error";
}) {
  if (!message) return null;
  const tones = {
    info: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    error:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200",
  };
  return (
    <p
      className={cn(
        "break-words rounded-md border px-4 py-3 text-sm",
        tones[tone],
      )}
    >
      {message}
    </p>
  );
}
