import FormAcao from '@/components/FormAcao';
import { salvarParceiro } from '@/app/actions/indireto';
import { documentoDe } from '@/lib/indireto';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export default function FormParceiro({ parceiro = {}, focais, statusLista = [], travarAtivacao = false, textoBotao = 'Salvar' }) {
  const p = parceiro;
  // só aparecem os status ativos (e o atual, se o gerente tiver desativado)
  const opcoes = statusLista.filter((st) => st.ativo || st.chave === p.status);
  const padrao = p.status || opcoes[0]?.chave || 'aguardando_interacao';
  return (
    <FormAcao acao={salvarParceiro}>
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <div className="grade-form">
        <label className="campo">Nome fantasia *<input type="text" name="nome_fantasia" defaultValue={p.nome_fantasia} required /></label>
        <label className="campo">Razão social / nome completo<input type="text" name="razao_social" defaultValue={p.razao_social || ''} /></label>
        <label className="campo">CPF ou CNPJ<input type="text" name="documento" defaultValue={documentoDe(p)} inputMode="numeric" placeholder="só números" /></label>
        <label className="campo">Código do parceiro / PDV<input type="text" name="codigo" defaultValue={p.codigo || ''} /></label>
        <label className="campo">Status
          <select name="status" defaultValue={padrao}>
            {opcoes.map((st) => <option key={st.chave} value={st.chave}>{st.nome}</option>)}
          </select>
        </label>
        <label className="campo">Início da parceria<input type="date" name="data_inicio" defaultValue={p.data_inicio || ''} /></label>
        <label className="campo">Data de ativação
          <input type="date" name="data_ativacao" defaultValue={p.data_ativacao || ''} readOnly={travarAtivacao} title={travarAtivacao ? 'Travada: cadastro validado ou prazo de 30 dias encerrado. Só o gerente ou um administrador altera.' : undefined} />
          {travarAtivacao && <span className="nome-sub">🔒 travada (só gerente ou admin altera)</span>}
        </label>
        <label className="campo">Ponto focal
          <select name="ponto_focal_id" defaultValue={p.ponto_focal_id || ''}>
            <option value="">Sem ponto focal</option>
            {focais.map((f) => <option key={f.id} value={f.id}>{f.nome || f.usuario}</option>)}
          </select>
        </label>
        <label className="campo">Cidade<input type="text" name="cidade" defaultValue={p.cidade || ''} /></label>
        <label className="campo">UF
          <select name="uf" defaultValue={p.uf || ''}>
            <option value="">—</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label className="campo campo-largo">Endereço<input type="text" name="endereco" defaultValue={p.endereco || ''} /></label>
        <label className="campo">Contato (nome)<input type="text" name="contato_nome" defaultValue={p.contato_nome || ''} /></label>
        <label className="campo">Telefone / WhatsApp<input type="text" name="contato_telefone" defaultValue={p.contato_telefone || ''} inputMode="tel" /></label>
        <label className="campo">E-mail<input type="email" name="contato_email" defaultValue={p.contato_email || ''} /></label>
        <label className="campo campo-largo">Observações<textarea name="observacoes" rows={3} defaultValue={p.observacoes || ''} /></label>
      </div>
      <button className="btn" type="submit" style={{ marginTop: 14 }}>{textoBotao}</button>
    </FormAcao>
  );
}
