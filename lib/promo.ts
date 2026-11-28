// Coupon codes that make a document free. Codes are matched
// case-insensitively, ignoring surrounding spaces and quotes.
// Server-side only — the client never decides a document is free;
// both the checkout route and the PDF route re-validate the code.
function normalizeCoupon(code: unknown): string {
  if (typeof code !== "string") return "";
  return code.trim().replace(/^['"]+|['"]+$/g, "").trim().toLowerCase();
}

function couponMatches(code: unknown, envValue: string | undefined): boolean {
  const coupon = normalizeCoupon(code);
  if (!coupon) return false;
  return (envValue || "")
    .split(/[\s,;]+/)
    .map((item) => normalizeCoupon(item))
    .filter(Boolean)
    .some((item) => item === coupon);
}

export function isValidCoupon(code: unknown): boolean {
  return couponMatches(code, process.env.LEGAL_FREE_COUPONS);
}

// Coupon codes that grant one free week of weekly membership.
// Same matching rules; validated only in the membership route,
// which records the grant directly (no Stripe involved).
export function isValidFreeWeekCoupon(code: unknown): boolean {
  return couponMatches(code, process.env.LEGAL_FREE_WEEK_COUPONS);
}
