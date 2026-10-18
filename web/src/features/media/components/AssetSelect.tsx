import type { MediaAsset } from "../../../shared/types/domain";

export function AssetSelect({
  label,
  assets,
  value,
  onChange,
  emptyText = "No hay archivos disponibles",
  disabled,
}: {
  label: string;
  assets: MediaAsset[];
  value: string;
  onChange: (assetId: string) => void;
  emptyText?: string;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        disabled={disabled || assets.length === 0}
        onChange={(event) => onChange(event.target.value)}
      >
        {assets.length === 0 ? (
          <option value="">{emptyText}</option>
        ) : (
          assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
