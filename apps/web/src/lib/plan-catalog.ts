export type MarketingPlanCode = "PRO";

export type MarketingPlan = {
  code: MarketingPlanCode;
  name: string;
  description: string;
  price: string;
  capacity: string;
  featured: boolean;
  features: string[];
};

export const marketingPlans: MarketingPlan[] = [
  {
    code: "PRO",
    name: "InfinityShop Pro",
    description: "Todo lo que necesitás para vender y hacer crecer tu tienda.",
    price: "$50.000",
    capacity: "Hasta 1.000 productos · 5 colaboradores",
    featured: true,
    features: [
      "Catálogo, carrito y checkout",
      "Mercado Pago directo a tu cuenta",
      "Stock, pedidos y clientes",
      "Analytics avanzados",
      "Cupones, promociones y variantes",
      "Recuperación de carritos",
      "Dominio y personalización avanzada",
      "Automatizaciones y soporte prioritario",
      "Sin comisión de InfinityShop por venta",
    ],
  },
];
