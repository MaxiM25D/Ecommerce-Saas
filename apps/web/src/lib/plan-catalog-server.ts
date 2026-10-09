import { marketingPlans, publicPlanToMarketingPlan, type MarketingPlan, type PublicPlan } from "./plan-catalog";

export async function loadMarketingPlans(): Promise<MarketingPlan[]> {
  const apiUrl = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");
  try {
    const response = await fetch(`${apiUrl}/billing/plans`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return marketingPlans;
    const body = await response.json() as { plans: PublicPlan[] };
    return body.plans.map(publicPlanToMarketingPlan);
  } catch {
    return marketingPlans;
  }
}
