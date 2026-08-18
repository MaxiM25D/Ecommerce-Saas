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
  brand: string | null;
  tags: string[];
  featured: boolean;
  featuredOrder: number;
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
    secondaryColor: string;
    fontFamily: string;
    borderRadius: string;
    announcement: string | null;
    showPoweredBy: boolean;
    contactEmail: string | null;
    whatsapp: string | null;
    currency: string;
    bankName: string | null;
    bankAlias: string | null;
    bankHolder: string | null;
    bankCvu: string | null;
    bankCuit: string | null;
    bankTransferEnabled: boolean;
    bankReservationHours: number;
    emailFromName: string | null;
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
  paymentReceipt: { originalName: string; updatedAt: string } | null;
};

export type OrderDetail = OrderSummary & {
  customerPhone: string | null;
  shippingAddress: string | null;
  notes: string | null;
  stockStatus: string;
  stockExpiresAt: string | null;
  shipment: {
    carrier: string;
    trackingCode: string | null;
    trackingUrl: string | null;
    estimatedDelivery: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    notificationStatus: string;
    notificationAttempts: number;
    notificationError: string | null;
  } | null;
  statusHistory: Array<{
    id: string;
    status: string;
    note: string | null;
    createdAt: string;
  }>;
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

export type CustomerSummary = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  approvedSpentInCents: number;
  _count: { orders: number };
};

export type CustomerDetail = CustomerSummary & {
  stats: {
    orders: number;
    approvedOrders: number;
    approvedSpentInCents: number;
  };
  orders: Array<{
    id: string;
    number: number;
    status: string;
    paymentStatus: string;
    totalInCents: number;
    currency: string;
    createdAt: string;
    _count: { items: number };
  }>;
};
