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
    bankName: string | null;
    bankAlias: string | null;
    bankHolder: string | null;
  } | null;
};

export type OrderSummary = {
  id: string;
  number: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  customerName: string;
  customerEmail: string;
  totalInCents: number;
  currency: string;
  createdAt: string;
  _count: { items: number };
};

export type OrderDetail = OrderSummary & {
  customerPhone: string | null;
  shippingAddress: string | null;
  notes: string | null;
  items: Array<{
    id: string;
    sku: string;
    productName: string;
    quantity: number;
    unitPriceInCents: number;
    subtotalInCents: number;
  }>;
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
