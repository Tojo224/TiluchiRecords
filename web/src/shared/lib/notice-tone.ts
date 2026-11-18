/** Tone of the last user-triggered message kept in page state. */
export type MessageTone = "success" | "error";

type NoticeTone = MessageTone | "info";

/**
 * Tone of a page Notice: a failed job wins, then an active job (shown with
 * `activeTone`), otherwise the tone of the last message.
 */
export function resolveNoticeTone(
  messageTone: MessageTone,
  status: { failed: boolean; active: boolean; activeTone: NoticeTone },
): NoticeTone {
  if (status.failed) return "error";
  if (status.active) return status.activeTone;
  return messageTone;
}
