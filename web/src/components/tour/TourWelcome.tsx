import { Compass } from "lucide-react";
import { useId, type KeyboardEvent } from "react";
import { useTour } from "../../tour/useTour";
import { Button } from "../ui/Button";

/**
 * First-run welcome. Rendered in the page flow (not as a blocking overlay) so
 * it never intercepts clicks; Escape or "Ahora no" closes it.
 */
export function TourWelcome() {
  const { showWelcome, completeWelcome, startMission, nextMission } = useTour();
  const titleId = useId();
  if (!showWelcome) return null;

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") completeWelcome();
  }

  return (
    <section
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50 sm:flex-row sm:items-center"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
        <Compass size={24} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-base font-semibold">
          Bienvenido a TiluchiRecords
        </h2>
        <p className="mt-1 text-sm">
          Todo vive dentro de un proyecto: ahi guardas tus archivos y encuentras
          tus resultados.
        </p>
        <p className="mt-1 text-sm">
          El camino habitual es Karaoke, luego Video desde musica y, si quieres,
          Face swap. Te acompanamos paso a paso, a tu ritmo.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" onClick={completeWelcome}>
          Ahora no
        </Button>
        <Button
          onClick={() => {
            completeWelcome();
            if (nextMission) startMission(nextMission.id);
          }}
        >
          Empezar guia
        </Button>
      </div>
    </section>
  );
}
