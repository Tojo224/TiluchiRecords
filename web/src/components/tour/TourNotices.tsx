import { useEffect } from "react";
import { useTour, type TourNotice } from "../../tour/useTour";
import { Notice } from "../ui/Notice";

const AUTO_HIDE_MS = 6000;

function AutoHideNotice({
  notice,
  onHide,
}: {
  notice: TourNotice;
  onHide: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onHide(notice.id), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [notice.id, onHide]);
  return (
    <div className="pointer-events-auto w-full max-w-sm shadow-lg">
      <Notice message={notice.message} tone={notice.tone} />
    </div>
  );
}

/** Polite live region for mission toasts. Always mounted so SRs announce. */
export function TourNotices() {
  const { notices, dismissNotice } = useTour();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex flex-col items-center gap-2 px-4"
    >
      {notices.map((notice) => (
        <AutoHideNotice
          key={notice.id}
          notice={notice}
          onHide={dismissNotice}
        />
      ))}
    </div>
  );
}
