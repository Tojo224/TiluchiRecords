import { CheckCircle2, Film } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DisabledReason } from "@/components/ui/DisabledReason";
import { JobProgress } from "@/components/ui/JobProgress";
import { Panel } from "@/components/ui/Panel";
import { TOUR_ANCHORS, tourAnchor } from "@/tour/anchors";
import { clipStageLabel } from "../lib/scene-labels";
import type { MusicVideoState } from "../lib/music-video-state";

type PhaseTwoPanelProps = {
  state: MusicVideoState;
  clipRunning: boolean;
  composeRunning: boolean;
  progress: number;
  blockers: string[];
  onProduce: () => void;
};

export function PhaseTwoPanel({
  state,
  clipRunning,
  composeRunning,
  progress,
  blockers,
  onProduce,
}: PhaseTwoPanelProps) {
  return (
    <Panel className="border-cyan-200/80 dark:border-cyan-500/25">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
          {state.finalVideo ? <CheckCircle2 size={24} /> : <Film size={24} />}
        </span>
        <div>
          <span className="text-xs font-semibold uppercase text-cyan-700 dark:text-cyan-400">
            Fase 2
          </span>
          <h2 className="font-semibold">Generar y componer el videoclip</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Genera los clips del plan aprobado y los une con la musica.
          </p>
        </div>
      </div>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-[#081216]">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Plan
            </span>
            <strong className="mt-1 block text-sm">
              {state.storyboard
                ? `${state.scenes.length} escenas listas`
                : "Pendiente de revision"}
            </strong>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-[#081216]">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Resultado
            </span>
            <strong className="mt-1 block truncate text-sm">
              {state.finalVideo?.name ||
                `${state.clips.length} clips generados`}
            </strong>
          </div>
        </div>
        {(state.clipJob || state.composeJob) && (
          <JobProgress
            label={
              state.finalVideo
                ? "Videoclip terminado"
                : composeRunning
                  ? "Componiendo video y musica"
                  : clipRunning
                    ? clipStageLabel(
                        state.clipJob?.result?.stage,
                        state.clipJob?.result?.sceneIndex,
                        state.clipJob?.result?.sceneCount,
                      )
                    : "Preparando composicion"
            }
            progress={progress}
          />
        )}
        <div className="rounded-lg border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          {state.storyboard
            ? "Revisa el plan de escenas de abajo. Cuando estes conforme, inicia la produccion."
            : "Esta fase se habilitara cuando el plan de escenas este listo."}
        </div>
        <Button
          onClick={onProduce}
          {...tourAnchor(TOUR_ANCHORS.musicProduce)}
          disabled={blockers.length > 0}
          aria-describedby={blockers.length ? "produce-blockers" : undefined}
        >
          <Film size={17} />
          {clipRunning
            ? `Generando clips ${state.clipJob?.progress || 0}%`
            : composeRunning
              ? `Componiendo ${state.composeJob?.progress || 0}%`
              : state.finalVideo
                ? "Generar nuevamente"
                : "Generar videoclip"}
        </Button>
        <DisabledReason id="produce-blockers" reasons={blockers} />
      </div>
    </Panel>
  );
}
