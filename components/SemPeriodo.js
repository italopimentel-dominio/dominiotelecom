import Link from 'next/link';

export default function SemPeriodo({ podeEditar }) {
  return (
    <div className="vazio">
      <h2>Nenhum período cadastrado</h2>
      <p>Cadastre o mês para começar a lançar metas.</p>
      {podeEditar ? <Link className="btn" href="/periodos">Cadastrar período</Link> : <p>Peça a um editor para cadastrar o período.</p>}
    </div>
  );
}
