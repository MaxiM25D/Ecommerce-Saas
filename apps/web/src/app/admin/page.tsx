import { AdminPanel } from "@/components/admin/admin-panel";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <AdminPanel mercadoPagoMessage={typeof query.message === "string" ? query.message : undefined} mercadoPagoResult={typeof query.mercadopago === "string" ? query.mercadopago : undefined} openStore={query.tab === "store" || Boolean(query.mercadopago)} />;
}
