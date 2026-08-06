export type Role = "OWNER" | "ADMIN" | "STAFF";

export type Category = {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number };
};

export type Product = {
  id: string;
  categoryId: string | null;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  priceInCents: number;
  stock: number;
  images: string[];
  active: boolean;
  category: Pick<Category, "id" | "name" | "slug"> | null;
};

export type Store = {
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  settings: {
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    primaryColor: string;
    contactEmail: string | null;
    whatsapp: string | null;
    currency: string;
  } | null;
};

export type Dashboard = {
  metrics: {
    categories: number;
    products: number;
    activeProducts: number;
    customers: number;
    orders: number;
    approvedRevenueInCents: number;
  };
  recentOrders: Array<{
    id: string;
    number: number;
    customerName: string;
    totalInCents: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }>;
};
