import { CustomerOrdersPage } from "@/components/storefront/customer-orders-page";

export default async function CustomerOrdersRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    email?: string;
    firstName?: string;
    lastName?: string;
    mode?: "login" | "register";
  }>;
}) {
  const [{ slug }, access] = await Promise.all([params, searchParams]);
  return (
    <CustomerOrdersPage
      initialEmail={access.email}
      initialFirstName={access.firstName}
      initialLastName={access.lastName}
      initialMode={access.mode}
      slug={slug}
    />
  );
}
