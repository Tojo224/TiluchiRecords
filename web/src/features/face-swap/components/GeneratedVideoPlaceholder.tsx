import { FileVideo2, Video } from "lucide-react";
import { Panel } from "@/components/ui/Panel";

export function GeneratedVideoPlaceholder() {
  return (
    <Panel className="overflow-hidden p-0">
      <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/10">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
          <Video size={21} />
        </span>
        <span>
          <strong className="block text-sm">Video generado</strong>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Pendiente
          </span>
        </span>
      </div>
      <div className="m-5 grid min-h-28 place-items-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 py-5 text-center dark:border-white/10 dark:bg-[#081216]">
        <div className="grid justify-items-center gap-2 text-zinc-500 dark:text-zinc-400">
          <FileVideo2 size={27} strokeWidth={1.5} />
          <p className="text-sm">El video generado aparecera aqui.</p>
          <span className="text-xs">
            Inicia el reemplazo para obtener el resultado.
          </span>
        </div>
      </div>
    </Panel>
  );
}
