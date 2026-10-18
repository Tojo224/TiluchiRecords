import { Film, Mic2, Sparkles } from "lucide-react";
import { PageHeader } from "../../../components/ui/PageHeader";
import type { MediaAsset, MediaAssetKind } from "../../../shared/types/domain";
import { useProject } from "../../projects/context/ProjectContext";
import { MediaPlayer } from "../components/MediaPlayer";

const RESULT_GROUPS: Array<{
  kind: MediaAssetKind;
  title: string;
  itemTitle: string;
  description: string;
  emptyText: string;
  icon: typeof Film;
}> = [
  {
    kind: "KARAOKE_VIDEO",
    title: "Videos karaoke",
    itemTitle: "Video karaoke",
    description: "Videos finales con pista instrumental y letra sincronizada.",
    emptyText: "Todavia no generaste un video karaoke.",
    icon: Mic2,
  },
  {
    kind: "FACE_SWAP_RESULT_VIDEO",
    title: "Resultados de face swap",
    itemTitle: "Video con face swap",
    description: "Videos terminados con el reemplazo facial aplicado.",
    emptyText: "Todavia no generaste un resultado de face swap.",
    icon: Sparkles,
  },
  {
    kind: "FINAL_VIDEOCLIP",
    title: "Videoclips finales",
    itemTitle: "Videoclip final",
    description: "Composiciones finales sincronizadas con la musica.",
    emptyText: "Todavia no compusiste un videoclip final.",
    icon: Film,
  },
];

export function isFinalResult(asset: MediaAsset) {
  return (
    asset.origin === "GENERATED" &&
    asset.status === "READY" &&
    RESULT_GROUPS.some((group) => group.kind === asset.kind)
  );
}

export function ResultsPage() {
  const { project, assetUrls, downloadAsset } = useProject();
  const finalResults = (project.mediaAssets || [])
    .filter(isFinalResult)
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );

  return (
    <>
      <PageHeader
        title="Resultados"
        description={`${project.name} · Solo entregables finales`}
      />

      <div className="grid gap-8">
        {RESULT_GROUPS.map((group) => {
          const assets = finalResults.filter(
            (asset) => asset.kind === group.kind,
          );
          const Icon = group.icon;

          return (
            <section key={group.kind} aria-labelledby={`results-${group.kind}`}>
              <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id={`results-${group.kind}`}
                      className="text-base font-semibold text-zinc-950 dark:text-white"
                    >
                      {group.title}
                    </h2>
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                      {group.description}
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                  {assets.length}{" "}
                  {assets.length === 1 ? "resultado" : "resultados"}
                </span>
              </header>

              {assets.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {assets.map((asset) => (
                    <MediaPlayer
                      key={asset.id}
                      title={group.itemTitle}
                      asset={asset}
                      url={assetUrls[asset.id]}
                      onDownload={downloadAsset}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid min-h-28 place-items-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-5 text-center dark:border-white/10 dark:bg-white/[0.02]">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {group.emptyText}
                  </p>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
