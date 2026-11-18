import { ChangeEvent, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { tourAnchor, type TourAnchorName } from "../../../tour/anchors";

export function FileUpload({
  accept,
  label = "Seleccionar archivo",
  busy,
  anchor,
  onSelect,
}: {
  accept: string;
  label?: string;
  busy?: boolean;
  /** Optional guided-tour anchor applied to the visible button. */
  anchor?: TourAnchorName;
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
        {...(anchor ? tourAnchor(anchor) : {})}
      >
        <Upload size={18} />
        {uploading ? "Subiendo..." : label}
      </Button>
    </>
  );
}
