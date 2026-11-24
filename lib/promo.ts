// Coupon codes that make a document free. Codes are matched
// case-insensitively, ignoring surrounding spaces. Server-side
// only — the client never decides a document is free; both the
// checkout route and the PDF route re-validate the code.
export function isValidCoupon(code: unknown): boolean {
  if (typeof code !== "string") return false;
  const coupon = code.trim().toLowerCase();
  if (!coupon) return false;
  return (process.env.LEGAL_FREE_COUPONS || '').split(',').some((item) => item.trim().toLowerCase() === coupon);
}
