import { Play, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { JobProgress } from "@/components/ui/JobProgress";
import { Panel } from "@/components/ui/Panel";

type ConsentPanelProps = {
  consent: boolean;
  swapRunning: boolean;
  swapProgress: number;
  selectedCount: number;
  runDisabled: boolean;
  onConsentChange: (consent: boolean) => void;
  onRun: () => void;
};

export function ConsentPanel({
  consent,
  swapRunning,
  swapProgress,
  selectedCount,
  runDisabled,
  onConsentChange,
  onRun,
}: ConsentPanelProps) {
  return (
    <Panel className="border-emerald-200/80 bg-gradient-to-r from-white to-emerald-50/40 dark:border-emerald-500/20 dark:from-[#0b171c] dark:to-emerald-950/20">
      <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <ShieldCheck size={22} />
          </span>
          <div>
            <h2 className="font-semibold">Confirmacion</h2>
            <label className="flex items-start gap-3">
              <input
                className="mt-1 size-4 w-auto"
                type="checkbox"
                checked={consent}
                onChange={(event) => onConsentChange(event.target.checked)}
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-300">
                Confirmo que tengo derechos o autorizacion sobre los archivos y
                acepto utilizar esta funcion de forma responsable.
              </span>
            </label>
          </div>
        </div>
        {swapRunning && (
          <div className="lg:col-span-2">
            <JobProgress
              label="Aplicando reemplazo facial"
              progress={swapProgress}
            />
          </div>
        )}
        <Button className="min-w-52" onClick={onRun} disabled={runDisabled}>
          <Play size={17} />
          {selectedCount > 1
            ? `Reemplazar ${selectedCount} personas`
            : "Iniciar reemplazo"}
        </Button>
      </div>
    </Panel>
  );
}
