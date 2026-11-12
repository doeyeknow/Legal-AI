// Coupon codes that make a document free. Codes are matched
// case-insensitively, ignoring surrounding spaces. Server-side
// only — the client never decides a document is free; both the
// checkout route and the PDF route re-validate the code.
const FREE_CODES = new Set<string>(["jewlz"]);

export function isValidCoupon(code: unknown): boolean {
  if (typeof code !== "string") return false;
  return FREE_CODES.has(code.trim().toLowerCase());
}
