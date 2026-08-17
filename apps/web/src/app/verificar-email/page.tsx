import { VerifyEmailAction } from "@/components/account-security-forms";
import { AuthActionShell } from "@/components/auth-action-shell";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; sent?: string }> }) { const query = await searchParams; return <AuthActionShell><VerifyEmailAction sent={query.sent === "1"} token={query.token ?? ""} /></AuthActionShell>; }
