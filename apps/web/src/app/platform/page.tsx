import { PlatformPanel } from "@/components/platform/platform-panel";

const sections = new Set(["overview", "stores", "plans", "operations", "support"] as const);

export default async function PlatformPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const requested = typeof query.section === "string" && sections.has(query.section as "overview" | "stores" | "plans" | "operations" | "support")
    ? query.section as "overview" | "stores" | "plans" | "operations" | "support"
    : "overview";
  return <PlatformPanel initialSection={requested} />;
}
