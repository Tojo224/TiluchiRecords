import { cn } from "../../shared/lib/format";

/**
 * Explains next to a disabled action which requirements are still missing.
 * Renders nothing when there are none. Link it from the button with
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
  if (reasons.length === 0) return null;
  return (
    <p
      id={id}
      role="status"
      className={cn(
        "text-xs font-medium text-amber-700 dark:text-amber-300",
        className,
      )}
    >
      Falta: {reasons.join(" · ")}
    </p>
  );
}
