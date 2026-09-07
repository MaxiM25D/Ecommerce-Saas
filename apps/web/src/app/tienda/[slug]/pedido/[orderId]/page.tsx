import { OrderStatusPage } from "@/components/storefront/order-status-page";

export default async function Page({
  params,
  searchParams,
}: PageProps<"/tienda/[slug]/pedido/[orderId]"> & {
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ slug, orderId }, { token }] = await Promise.all([
    params,
    searchParams,
  ]);
  return <OrderStatusPage accessToken={token} orderId={orderId} slug={slug} />;
}
