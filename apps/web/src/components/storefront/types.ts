export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  _count: { products: number };
};

export type StorefrontProduct = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  images: string[];
  priceInCents: number;
  stock: number;
  brand: string | null;
  tags: string[];
  featured: boolean;
  category: Pick<StorefrontCategory, "id" | "name" | "slug"> | null;
};

export type PublicStore = {
  name: string;
  slug: string;
  settings: {
    description: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    primaryColor: string;
    contactEmail: string | null;
    whatsapp: string | null;
    currency: string;
  } | null;
  paymentMethods: {
    bankTransfer: boolean;
    mercadoPago: boolean;
  };
  categories?: StorefrontCategory[];
  products?: StorefrontProduct[];
};

export type CartItem = StorefrontProduct & { quantity: number };

export type CheckoutResult = {
  order: {
    id: string;
    number: number;
    status: string;
    paymentStatus: string;
    totalInCents: number;
    currency: string;
  };
  orderToken: string;
  payment: {
    method: "BANK_TRANSFER";
    bankName: string | null;
    alias: string | null;
    holder: string | null;
    cvu: string | null;
    cuit: string | null;
    reservationHours: number;
  } | {
    method: "MERCADO_PAGO";
    preferenceId: string;
    checkoutUrl: string;
  };
};
