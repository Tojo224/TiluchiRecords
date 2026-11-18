import { Panel } from "@/components/ui/Panel";
import type { StoryboardScene } from "@/shared/types/domain";
import {
  formatTimelineTime,
  friendlySceneDescription,
  intensityLabel,
  scenePhase,
  shotTypeLabel,
} from "../lib/scene-labels";

type SceneListProps = {
  scenes: StoryboardScene[];
  bpm: number;
};

export function SceneList({ scenes, bpm }: SceneListProps) {
  return (
    <Panel title="Plan de escenas">
      <div className="grid gap-3">
        {scenes.map((scene, index) => (
          <article
            key={`${scene.sceneIndex}-${scene.startTime}`}
            className="grid grid-cols-[3rem_1fr] gap-4 border-b border-zinc-200 pb-4 last:border-0 dark:border-zinc-800"
          >
            <b className="grid size-12 place-items-center bg-emerald-700 text-white">
              {scene.sceneIndex}
            </b>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <strong className="text-sm text-zinc-950 dark:text-zinc-50">
                  {scene.title || scenePhase(index, scenes.length)}
                </strong>
                <span className="text-xs font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatTimelineTime(scene.startTime)} -{" "}
                  {formatTimelineTime(scene.endTime)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {friendlySceneDescription(scene, index, scenes.length)}
              </p>
              {scene.lyrics && (
                <blockquote className="mt-2 border-l-2 border-emerald-600 pl-3 text-sm italic text-zinc-700 dark:text-zinc-300">
                  {scene.lyrics}
                </blockquote>
              )}
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                {scene.shotType && (
                  <span className="border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                    {shotTypeLabel(scene.shotType)}
                  </span>
                )}
                {scene.locationDescription && (
                  <span className="border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                    {scene.locationDescription}
                  </span>
                )}
                {scene.lipSync && (
                  <span className="border border-emerald-600 px-2 py-1 text-emerald-700 dark:text-emerald-400">
                    Canto sincronizado
                  </span>
                )}
                {scene.reusePolicy === "DIRECT" && scene.sourceSceneIndex && (
                  <span className="border border-sky-600 px-2 py-1 text-sky-700 dark:text-sky-400">
                    Reutiliza escena {scene.sourceSceneIndex}
                  </span>
                )}
                {scene.reusePolicy === "VARIANT" && scene.sourceSceneIndex && (
                  <span className="border border-amber-600 px-2 py-1 text-amber-700 dark:text-amber-400">
                    Variante de escena {scene.sourceSceneIndex}
                  </span>
                )}
                <span className="border border-zinc-200 px-2 py-1 tabular-nums dark:border-zinc-700">
                  Duracion: {Math.round(scene.endTime - scene.startTime)} s
                </span>
                <span className="border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                  {intensityLabel(scene, index, scenes.length)}
                </span>
                <span className="border border-zinc-200 px-2 py-1 tabular-nums dark:border-zinc-700">
                  Ritmo: {bpm} BPM
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}
