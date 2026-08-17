import { ResetPasswordForm } from "@/components/account-security-forms";
import { AuthActionShell } from "@/components/auth-action-shell";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token = "" } = await searchParams; return <AuthActionShell><ResetPasswordForm token={token} /></AuthActionShell>; }
