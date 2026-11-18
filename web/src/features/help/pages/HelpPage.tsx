import { Button } from "../../../components/ui/Button";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { cn } from "../../../shared/lib/format";
import { useTour } from "../../../tour/useTour";
import { HELP_SECTIONS, type HelpSection } from "../content/help-content";

const subheadingClass =
  "mt-5 text-sm font-semibold text-zinc-950 dark:text-zinc-50";
const listClass = "mt-2 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300";

function sectionHeadingId(section: HelpSection) {
  return `help-${section.id}-title`;
}

export function HelpPage() {
  const { startMission, restart, reopen } = useTour();

  return (
    <>
      <PageHeader
        title="Ayuda"
        description="Una guia corta para cada flujo de TiluchiRecords."
        actions={
          <>
            <Button variant="ghost" onClick={reopen}>
              Mostrar guia de inicio
            </Button>
            <Button variant="secondary" onClick={restart}>
              Repetir tutorial
            </Button>
          </>
        }
      />

      <Panel>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Elige un tema del indice, o practica con el tutorial interactivo: te
          marca en pantalla donde pulsar y se adapta a lo que ya hiciste.
        </p>
        <section aria-label="Indice de ayuda" className="mt-4">
          <ul className="grid gap-1 sm:grid-cols-2">
            {HELP_SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex min-h-10 items-center rounded-md px-2 text-sm font-medium text-emerald-800 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </Panel>

      {HELP_SECTIONS.map((section) => {
        const missionId = section.missionId;
        return (
          <Panel
            key={section.id}
            id={section.id}
            aria-labelledby={sectionHeadingId(section)}
            className="scroll-mt-24"
          >
            <header className="mb-2">
              <h2
                id={sectionHeadingId(section)}
                className="text-lg font-semibold text-zinc-950 dark:text-zinc-50"
              >
                {section.title}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {section.summary}
              </p>
            </header>

            <h3 className={subheadingClass}>Paso a paso</h3>
            <ol className={cn(listClass, "list-decimal pl-5")}>
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            {section.tips && section.tips.length > 0 && (
              <>
                <h3 className={subheadingClass}>Consejos</h3>
                <ul className={cn(listClass, "list-disc pl-5")}>
                  {section.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </>
            )}

            {section.troubleshooting && section.troubleshooting.length > 0 && (
              <>
                <h3 className={subheadingClass}>Si algo no funciona</h3>
                <div className="mt-2 grid gap-2">
                  {section.troubleshooting.map((item) => (
                    <details
                      key={item.problem}
                      className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-white/10"
                    >
                      <summary className="cursor-pointer font-medium text-zinc-900 dark:text-zinc-100">
                        {item.problem}
                      </summary>
                      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
                        {item.solution}
                      </p>
                    </details>
                  ))}
                </div>
              </>
            )}

            {missionId && (
              <div className="mt-5">
                <Button
                  variant="secondary"
                  aria-label={`Empezar tutorial interactivo: ${section.title}`}
                  onClick={() => startMission(missionId)}
                >
                  Empezar tutorial interactivo
                </Button>
              </div>
            )}
          </Panel>
        );
      })}
    </>
  );
}
