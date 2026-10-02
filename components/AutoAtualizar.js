'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Recarrega os dados da tela de tempos em tempos (modo TV)
export default function AutoAtualizar({ segundos = 60 }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
