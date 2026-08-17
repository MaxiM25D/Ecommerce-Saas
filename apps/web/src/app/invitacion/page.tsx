import { InvitationAcceptance } from "@/components/account-security-forms";
import { AuthActionShell } from "@/components/auth-action-shell";

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token = "" } = await searchParams; return <AuthActionShell><InvitationAcceptance token={token} /></AuthActionShell>; }
