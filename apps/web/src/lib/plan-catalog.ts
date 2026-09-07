export type MarketingPlanCode = "STARTER" | "PRO";

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
    code: "STARTER",
    name: "Starter",
    description: "Todo lo necesario para vender normalmente.",
    price: "$50.000",
    capacity: "Hasta 150 productos · 1 colaborador",
    featured: false,
    features: [
      "Catálogo, carrito y checkout",
      "Mercado Pago por tienda",
      "Transferencias y comprobantes",
      "Stock y gestión de pedidos",
      "Clientes y emails básicos",
      "Personalización de la tienda",
    ],
  },
  {
    code: "PRO",
    name: "Pro",
    description: "Más capacidad y automatización para crecer.",
    price: "$70.000",
    capacity: "Hasta 1.000 productos · 5 colaboradores",
    featured: true,
    features: [
      "Todo lo incluido en Starter",
      "Analytics avanzados",
      "Cupones, promociones y variantes",
      "Recuperación de carritos",
      "Dominio y diseño avanzado",
      "Automatizaciones y soporte prioritario",
    ],
  },
];
