/**
 * Utility functions for handling blocked UIDs
 * Blocks Agora Recorder UID and RTST Agent UIDs
 * These are bots and should not be treated as regular users
 */

// Blocked UIDs - Agora Recorder and RTST Agent
const BLOCKED_UIDS: Set<number> = new Set([999999999, 999999998]);

/**
 * Checks if a UID should proceed (not blocked)
 * Similar to Swift function: shouldProceedWithRemoteUsers(uid: UInt) -> Bool
 *
 * @param uid - The UID to check (can be string or number)
 * @returns true if the UID should proceed (not blocked), false if blocked
 */
export function shouldProceedWithRemoteUsers(
  uid: string | number | null | undefined
): boolean {
  if (uid === null || uid === undefined) {
    return false;
  }

  // Convert to number for comparison
  const uidNum = typeof uid === "string" ? parseInt(uid, 10) : uid;

  // Check if UID is in blocked set
  return !BLOCKED_UIDS.has(uidNum);
}

/**
 * Checks if a UID is blocked
 *
 * @param uid - The UID to check (can be string or number)
 * @returns true if the UID is blocked, false otherwise
 */
export function isBlockedUID(uid: string | number | null | undefined): boolean {
  return !shouldProceedWithRemoteUsers(uid);
}
