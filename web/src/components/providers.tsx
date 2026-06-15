'use client';

import { PropsWithChildren, useEffect, useRef } from 'react';
import { ConfigProvider } from '@arco-design/web-react';
import { useAuthStore } from '@/stores/auth-store';

const arcoThemeTokens = {
  primaryColor: '#2bc3e8',
  'arcoblue-6': '#2bc3e8',
  'arcoblue-7': '#163455',
  'arcoblue-8': '#0d1b2d',
};

export function Providers({ children }: PropsWithChildren) {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;
    void bootstrap();
  }, [bootstrap]);

  return <ConfigProvider theme={arcoThemeTokens}>{children}</ConfigProvider>;
}
