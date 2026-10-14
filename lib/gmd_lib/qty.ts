export function parseQty(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * available = received - dispatch.
 * Returns null when either value is missing/blank, so callers can leave the
 * existing available_qty untouched.
 */
export function computeAvailableQty(
  received: unknown,
  dispatch: unknown,
): string | null {
  const r = parseQty(received);
  const d = parseQty(dispatch);
  if (r === null || d === null) return null;
  return String(r - d);
}