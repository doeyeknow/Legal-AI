export const MOTION_PRICE = 500;
export const MEMBERSHIP_PLANS = {
  weekly: { name: 'Weekly', amount: 1000, price: '$10', terms: 'Renews every week', interval: 'week' },
  yearly: { name: 'Yearly', amount: 5000, price: '$50', terms: 'Renews every year', interval: 'year' },
  lifetime: { name: 'Lifetime', amount: 10000, price: '$100', terms: 'One payment, no renewal', interval: null },
} as const;
export type MembershipPlan = keyof typeof MEMBERSHIP_PLANS;

export function isMembershipPlan(value: unknown): value is MembershipPlan {
  return typeof value === 'string' && Object.hasOwn(MEMBERSHIP_PLANS, value);
}
