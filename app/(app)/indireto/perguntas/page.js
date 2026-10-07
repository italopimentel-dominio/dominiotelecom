import Link from 'next/link';
import { redirect } from 'next/navigation';
import { exigirSessao, podeValidarIndireto } from '@/lib/auth';
import { TIPOS_TREINAMENTO } from '@/lib/indireto';
import FormAcao from '@/components/FormAcao';
import { salvarPergunta } from '@/app/actions/formularios';

const RESPOSTAS = { texto: 'Texto livre', escolha: 'Múltipla escolha', sim_nao: 'Sim ou não', nota: 'Nota de 0 a 10' };

function CamposPergunta({ p = {}, tipo }) {
  return (
    <>
      {p.id ? <input type="hidden" name="id" value={p.id} /> : <input type="hidden" name="tipo" value={tipo} />}
      <div className="campos">
        <label className="campo" style={{ flex: '4 1 320px' }}>Pergunta<input type="text" name="texto" defaultValue={p.texto || ''} required /></label>
        <label className="campo">Tipo de resposta
          <select name="tipo_resposta" defaultValue={p.tipo_resposta || 'texto'}>
            {Object.entries(RESPOSTAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="campo">Ordem<input type="number" name="ordem" defaultValue={p.ordem ?? 0} style={{ width: 70 }} /></label>
      </div>
      <div className="campos" style={{ marginTop: 6 }}>
        <label className="campo" style={{ flex: '2 1 240px' }}>Opções (só múltipla escolha, uma por linha)
          <textarea name="opcoes" rows={3} defaultValue={(p.opcoes || []).join('\n')} />
        </label>
        <label className="campo">Resposta certa (opcional, conta pontos)
          <input type="text" name="correta" defaultValue={p.correta || ''} placeholder="ex.: Sim, ou uma das opções" />
        </label>
        <label className="check"><input type="checkbox" name="obrigatoria" defaultChecked={p.obrigatoria ?? true} /> obrigatória</label>
        {p.id && <label className="check"><input type="checkbox" name="ativa" defaultChecked={p.ativa} /> ativa</label>}
        <button className="btn btn-sec btn-peq" type="submit">{p.id ? 'Salvar' : 'Adicionar pergunta'}</button>
      </div>
    </>
  );
}

export default async function PaginaPerguntas({ searchParams }) {
  const sp = await searchParams;
  const { perfil, supabase } = await exigirSessao();
  if (!podeValidarIndireto(perfil)) redirect('/indireto');
  const tipo = TIPOS_TREINAMENTO[sp.tipo] ? sp.tipo : 'onboarding';
  const { data: perguntas, error } = await supabase.from('form_perguntas').select('*').eq('tipo', tipo).order('ordem').order('criado_em');

  return (
    <>
      <div className="topo">
        <div>
          <p className="sub"><Link href="/indireto">← Controle Indireto</Link></p>
          <h1>Perguntas dos formulários</h1>
          <p className="sub">
            O que o parceiro responde pelo link depois de cada treinamento. Perguntas com resposta certa geram a pontuação (ex.: "acertou 4 de 5").
            Desativar tira a pergunta dos próximos formulários sem apagar as respostas antigas.
          </p>
        </div>
      </div>
      {error ? <p className="msg msg-erro">Rode o arquivo 025_formulario_link.sql no Supabase.</p> : (
        <>
          <div className="alternar-visao" style={{ marginBottom: 12 }}>
            {Object.entries(TIPOS_TREINAMENTO).map(([k, v]) => <Link key={k} href={`/indireto/perguntas?tipo=${k}`} className={k === tipo ? 'ativo' : ''}>{v}</Link>)}
          </div>
          {(perguntas || []).map((p, i) => (
            <section key={p.id} className={`bloco secao${p.ativa ? '' : ' inativo'}`} style={p.ativa ? undefined : { opacity: 0.6 }}>
              <p className="dica" style={{ marginBottom: 6 }}>Pergunta {i + 1}{p.ativa ? '' : ' (desativada)'}</p>
              <FormAcao acao={salvarPergunta}><CamposPergunta p={p} /></FormAcao>
            </section>
          ))}
          {!perguntas?.length && <p className="dica secao">Nenhuma pergunta ainda. Sem perguntas, o parceiro só confirma que participou do treinamento.</p>}
          <section className="bloco secao">
            <h2 style={{ marginBottom: 8 }}>Nova pergunta ({TIPOS_TREINAMENTO[tipo]})</h2>
            <FormAcao acao={salvarPergunta}><CamposPergunta tipo={tipo} /></FormAcao>
          </section>
        </>
      )}
    </>
  );
}
