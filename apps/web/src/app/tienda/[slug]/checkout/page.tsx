import { CheckoutPage } from "@/components/storefront/checkout-page";

export default async function PublicCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CheckoutPage slug={slug} />;
}
