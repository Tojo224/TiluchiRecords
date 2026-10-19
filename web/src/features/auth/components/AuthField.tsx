import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { InputHTMLAttributes, useId, useState } from "react";
import { cn } from "../../../shared/lib/format";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: LucideIcon;
  revealable?: boolean;
};

export function AuthField({
  label,
  icon: Icon,
  revealable = false,
  className,
  type,
  ...props
}: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const generatedId = useId();
  const inputId = props.id || generatedId;
  const inputType = revealable ? (revealed ? "text" : "password") : type;

  return (
    <div className="grid gap-2">
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-zinc-700 dark:text-zinc-200"
      >
        {label}
      </label>
      <span className="relative block">
        <Icon
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          size={18}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <input
          {...props}
          id={inputId}
          type={inputType}
          className={cn("h-12 pl-11", revealable && "pr-12", className)}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={revealed ? "Ocultar clave" : "Mostrar clave"}
            title={revealed ? "Ocultar clave" : "Mostrar clave"}
          >
            {revealed ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </span>
    </div>
  );
}
