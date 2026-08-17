import { OrderStatusPage } from "@/components/storefront/order-status-page";

export default async function Page({ params }: PageProps<"/tienda/[slug]/pedido/[orderId]">) {
  const { slug, orderId } = await params;
  return <OrderStatusPage orderId={orderId} slug={slug} />;
}
