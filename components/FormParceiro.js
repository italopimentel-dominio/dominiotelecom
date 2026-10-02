import FormAcao from '@/components/FormAcao';
import { salvarParceiro } from '@/app/actions/indireto';
import { STATUS_PARCEIRO, fmtCnpj } from '@/lib/indireto';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export default function FormParceiro({ parceiro = {}, focais, textoBotao = 'Salvar' }) {
  const p = parceiro;
  return (
    <FormAcao acao={salvarParceiro}>
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <div className="grade-form">
        <label className="campo">Nome fantasia *<input type="text" name="nome_fantasia" defaultValue={p.nome_fantasia} required /></label>
        <label className="campo">Razão social<input type="text" name="razao_social" defaultValue={p.razao_social || ''} /></label>
        <label className="campo">CNPJ<input type="text" name="cnpj" defaultValue={fmtCnpj(p.cnpj)} inputMode="numeric" placeholder="00.000.000/0000-00" /></label>
        <label className="campo">Código do parceiro / PDV<input type="text" name="codigo" defaultValue={p.codigo || ''} /></label>
        <label className="campo">Status
          <select name="status" defaultValue={p.status || 'onboarding'}>
            {Object.entries(STATUS_PARCEIRO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="campo">Início da parceria<input type="date" name="data_inicio" defaultValue={p.data_inicio || ''} /></label>
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
