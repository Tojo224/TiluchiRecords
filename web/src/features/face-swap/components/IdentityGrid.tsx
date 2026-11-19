import { Check } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { TOUR_ANCHORS, tourAnchor } from "@/tour/anchors";
import type { FaceIdentity } from "../lib/face-swap-state";

type IdentityGridProps = {
  identities: FaceIdentity[];
  selectedIdentityIds: string[];
  disabled: boolean;
  onSelectionChange: Dispatch<SetStateAction<string[]>>;
};

export function IdentityGrid({
  identities,
  selectedIdentityIds,
  disabled,
  onSelectionChange,
}: IdentityGridProps) {
  return (
    <div className="grid gap-4" {...tourAnchor(TOUR_ANCHORS.faceSwapPeople)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {identities.map((identity) => {
          const selected = selectedIdentityIds.includes(identity.id);
          return (
            <button
              key={identity.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() =>
                onSelectionChange((current) =>
                  current.includes(identity.id)
                    ? current.filter((identityId) => identityId !== identity.id)
                    : [...current, identity.id],
                )
              }
              className={`group relative overflow-hidden rounded-lg border bg-white text-left transition dark:bg-[#081216] ${
                selected
                  ? "border-emerald-500 ring-2 ring-emerald-500/25 dark:bg-emerald-950/25"
                  : "border-zinc-200 hover:border-emerald-400 dark:border-white/10 dark:hover:border-emerald-500/60"
              }`}
            >
              <span
                className={`absolute left-3 top-3 z-10 grid size-6 place-items-center rounded border shadow-sm ${selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-white/70 bg-zinc-950/55 text-transparent"}`}
              >
                <Check size={15} />
              </span>
              <img
                className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                src={identity.thumbnailDataUrl}
                alt={identity.label}
              />
              <span className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="min-w-0">
                  <strong className="block truncate text-sm">
                    {identity.label}
                  </strong>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Vista en {identity.appearanceCount} muestras
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
