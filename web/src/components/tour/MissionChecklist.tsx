import { CheckCircle2, Circle, Compass } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../shared/lib/format";
import { missionProgress } from "../../tour/missions";
import { useTour } from "../../tour/useTour";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

/**
 * Floating "Guia" launcher with the mission checklist. Bottom-right so it
 * never covers the sidebar or the main call to action of a page.
 */
export function MissionChecklist() {
  const {
    progress,
    missions,
    percent,
    activeMissionId,
    startMission,
    dismiss,
  } = useTour();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // Hidden until loaded, once dismissed and while a tour is running.
  if (!progress || progress.dismissed || activeMissionId) return null;

  const { done, total } = missionProgress(progress.completed);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2"
      onKeyDown={onKeyDown}
    >
      {open && (
        <Panel
          id={panelId}
          aria-label="Guia de inicio"
          title="Guia de inicio"
          className="max-h-[70vh] w-80 max-w-full overflow-y-auto shadow-xl"
        >
          <div className="mb-4 grid gap-1.5">
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Tu progreso</span>
              <span>
                {done} de {total}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Progreso de la guia"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10"
            >
              <div
                className="h-full rounded-full bg-emerald-600 transition-all dark:bg-emerald-400"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <ul className="grid gap-3">
            {missions.map((mission) => (
              <li key={mission.id} className="flex items-start gap-3">
                {mission.done ? (
                  <CheckCircle2
                    size={20}
                    className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    size={20}
                    className="mt-0.5 shrink-0 text-zinc-300 dark:text-zinc-600"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      mission.done &&
                        "text-zinc-500 line-through dark:text-zinc-500",
                    )}
                  >
                    {mission.title}
                    {mission.optional && (
                      <span className="ml-1.5 text-xs font-normal text-zinc-400">
                        (opcional)
                      </span>
                    )}
                  </p>
                  {mission.done && <span className="sr-only">Completada</span>}
                  {!mission.done && (
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {mission.why}
                    </p>
                  )}
                </div>
                <Button
                  variant={mission.done ? "ghost" : "secondary"}
                  className="min-h-8 shrink-0 px-3 text-xs"
                  aria-label={`${mission.done ? "Ir a" : "Empezar"}: ${mission.title}`}
                  onClick={() => {
                    setOpen(false);
                    startMission(mission.id);
                  }}
                >
                  {mission.done ? "Ir" : "Empezar"}
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Link
              to="/help"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-emerald-800 underline-offset-2 hover:underline dark:text-emerald-300"
            >
              Ver manual de ayuda
            </Link>
            <Button variant="ghost" className="text-xs" onClick={dismiss}>
              Ocultar guia
            </Button>
          </div>
        </Panel>
      )}
      <Button
        variant="secondary"
        className="rounded-full shadow-lg"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <Compass size={18} aria-hidden="true" />
        Guia
        <span className="text-xs opacity-70">
          {done}/{total}
        </span>
      </Button>
    </div>
  );
}
