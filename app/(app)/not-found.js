import Link from 'next/link';
export default function NaoEncontrado() {
  return <div className="vazio"><h2>Página não encontrada</h2><p>O endereço pode ter mudado ou o item foi removido.</p><Link className="btn" href="/">Voltar ao painel</Link></div>;
}
