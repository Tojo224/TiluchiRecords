import { cn } from "../../shared/lib/format";

/**
 * Explains next to a disabled action which requirements are still missing.
 * The live region stays mounted (screen-reader only while empty) so later
 * changes are announced. Link it from the button with
 * `aria-describedby={id}` while the list is not empty.
 */
export function DisabledReason({
  id,
  reasons,
  className,
}: {
  id: string;
  reasons: string[];
  className?: string;
}) {
  const empty = reasons.length === 0;
  return (
    <p
      id={id}
      role="status"
      className={cn(
        empty
          ? "sr-only"
          : "text-xs font-medium text-amber-700 dark:text-amber-300",
        !empty && className,
      )}
    >
      {empty ? null : `Falta: ${reasons.join(" · ")}`}
    </p>
  );
}
