/**
 * Agora / IM can echo multi-device or session warnings as normal chat text
 * (often self-sent as `You → <groupId>: <text>`). Those should not appear as bubbles.
 */

export function shouldSuppressMultiDeviceSessionChatPayload(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s) return false;

  if (s.includes("user_already_login")) return true;
  if (s.includes("kicked by another device")) return true;
  if (s.includes("chat session taken")) return true;
  if (s.includes("auto-reconnect paused")) return true;

  const tabOrDevice =
    s.includes("another tab") ||
    s.includes("another device") ||
    s.includes("other tab") ||
    s.includes("other device");

  if (!tabOrDevice) return false;

  if (s.includes("you are sending")) return true;
  if (s.includes("same account")) return true;
  if (s.includes("connected in another")) return true;
  if (s.includes("logged in") && s.includes("another")) return true;
  if (s.includes("duplicate") && s.includes("login")) return true;
  if (s.includes("open in another")) return true;
  if (s.includes("already open") && s.includes("tab")) return true;

  return false;
}

/** Message body from `addLog` formats used by messageHandlers / FPChatApp. */
export function extractChatBodyFromLogLine(log: string): string | null {
  if (log.includes("→")) {
    const m = log.match(/You → [^:]+: (.+)$/);
    return m ? m[1].trim() : null;
  }
  const incomingSep = ": ";
  const sepIdx = log.indexOf(incomingSep);
  if (sepIdx > 0) {
    return log.slice(sepIdx + incomingSep.length).trim();
  }
  return null;
}
