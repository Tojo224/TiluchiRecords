import { useEffect, useState } from "react";
import type { MediaAsset } from "../../../shared/types/domain";

export function useSelectedAsset(assets: MediaAsset[]) {
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    if (assets.some((asset) => asset.id === selectedId)) return;
    setSelectedId(assets[0]?.id || "");
  }, [assets, selectedId]);

  return {
    selectedId,
    setSelectedId,
    selectedAsset: assets.find((asset) => asset.id === selectedId),
  };
}
