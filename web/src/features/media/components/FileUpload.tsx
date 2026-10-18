import { ChangeEvent, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "../../../components/ui/Button";

export function FileUpload({
  accept,
  label = "Seleccionar archivo",
  busy,
  onSelect,
}: {
  accept: string;
  label?: string;
  busy?: boolean;
  onSelect: (file: File) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function change(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onSelect(file);
      if (input.current) input.current.value = "";
    } finally {
      setUploading(false);
    }
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
        disabled={busy || uploading}
        onClick={() => input.current?.click()}
      >
        <Upload size={18} />
        {uploading ? "Subiendo..." : label}
      </Button>
    </>
  );
}
