"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "./api";
import { marketingPlans, publicPlanToMarketingPlan, type MarketingPlan, type PublicPlan } from "./plan-catalog";

export function useMarketingPlans(): MarketingPlan[] {
  const [plans, setPlans] = useState(marketingPlans);
  useEffect(() => {
    let active = true;
    void apiRequest<{ plans: PublicPlan[] }>("/billing/plans")
      .then(({ plans: values }) => { if (active) setPlans(values.map(publicPlanToMarketingPlan)); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return plans;
}
