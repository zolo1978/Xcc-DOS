'use client';

import { PropsWithChildren, useEffect } from 'react';
import { Spin } from '@arco-design/web-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export function AuthGuard({ children }: PropsWithChildren) {
  const status = useAuthStore((state) => state.status);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      const target = pathname ? `/login?redirect=${encodeURIComponent(pathname)}` : '/login';
      router.replace(target);
    }
  }, [pathname, router, status]);

  if (status !== 'authenticated') {
    return (
      <div className="page-shell page-shell--center">
        <Spin size={28} />
      </div>
    );
  }

  return <>{children}</>;
}
