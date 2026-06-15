import { LoginPage } from '@/features/auth/login-page';

export default function LoginRoute({
  searchParams,
}: {
  searchParams?: { redirect?: string };
}) {
  return <LoginPage redirectTo={searchParams?.redirect ?? '/dashboard'} />;
}
