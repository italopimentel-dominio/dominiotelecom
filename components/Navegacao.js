'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navegacao({ itens }) {
  const caminho = usePathname();
  return (
    <nav className="nav" aria-label="Principal">
      {itens.map((i) => {
        const ativo = i.href === '/' ? caminho === '/' || caminho.startsWith('/grupos') || caminho.startsWith('/colaboradores') : caminho.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={ativo ? 'nav-item ativo' : 'nav-item'} aria-current={ativo ? 'page' : undefined}>
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
