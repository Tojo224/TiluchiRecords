import {
  ChangeEvent,
  DragEvent,
  useRef,
  useState,
} from "react";
import { Upload, UploadCloud, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { formatBytes } from "../../../shared/lib/format";

export function FileUpload({
  accept,
  label = "Seleccionar archivo",
  description,
  busy,
  mode = "button",
  className = "",
  onSelect,
}: {
  accept: string;
  label?: string;
  description?: string;
  busy?: boolean;
  mode?: "button" | "dropzone";
  className?: string;
  onSelect: (file: File) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;
    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);
    setUploading(true);
    setProgress(15);

    // Simulate steady progress feedback if standard Promise doesn't stream progress directly
    const interval = setInterval(() => {
      setProgress((prev) => (prev < 90 ? prev + Math.floor(Math.random() * 15) : prev));
    }, 200);

    try {
      await onSelect(file);
      setProgress(100);
      if (input.current) input.current.value = "";
    } finally {
      clearInterval(interval);
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        setSelectedFileName("");
        setSelectedFileSize(null);
      }, 1000);
    }
  }

  function change(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!busy && !uploading) setIsDragOver(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (busy || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  if (mode === "dropzone") {
    return (
      <div className={`w-full ${className}`}>
        <input
          ref={input}
          className="sr-only"
          type="file"
          accept={accept}
          onChange={change}
        />
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !busy && !uploading && input.current?.click()}
          className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center transition-all duration-200 ${
            isDragOver
              ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
              : "border-zinc-300 hover:border-emerald-500/60 bg-zinc-50/70 hover:bg-zinc-100/60 dark:border-white/10 dark:bg-[#081317]/80 dark:hover:border-emerald-500/40 dark:hover:bg-[#0a181d]"
          } ${busy || uploading ? "pointer-events-none opacity-85" : ""}`}
        >
          {uploading ? (
            <div className="flex w-full max-w-sm flex-col items-center gap-3">
              <div className="relative size-12">
                <Loader2 className="size-12 animate-spin text-emerald-500" />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-emerald-500">
                  {progress}%
                </span>
              </div>
              <div className="w-full">
                <div className="flex justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  <span className="truncate max-w-[200px]">{selectedFileName}</span>
                  <span>{selectedFileSize ? formatBytes(selectedFileSize) : ""}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 animate-pulse">
                {progress === 100 ? "Confirmando en almacenamiento S3..." : "Transfiriendo archivo..."}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 rounded-2xl bg-emerald-500/10 p-3.5 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-200 shadow-sm">
                <UploadCloud className="size-6" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {label}
              </h4>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Arrastra y suelta tu archivo aquí, o haz clic para explorar
              </p>
              {description && (
                <span className="mt-2.5 inline-flex items-center rounded-md bg-zinc-200/60 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                  {description}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept={accept}
        onChange={change}
      />
      <Button
        variant="secondary"
        className={className}
        disabled={busy || uploading}
        onClick={() => input.current?.click()}
      >
        {uploading ? (
          <>
            <Loader2 size={16} className="animate-spin text-emerald-500" />
            <span>Subiendo ({progress}%)...</span>
          </>
        ) : (
          <>
            <Upload size={17} />
            <span>{label}</span>
          </>
        )}
      </Button>
    </>
  );
}
