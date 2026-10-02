import FormAcao from '@/components/FormAcao';
import { TEMAS } from '@/lib/campanhas';

export default function FormCampanha({ acao, c = {}, comItens = false, botao }) {
  return (
    <FormAcao acao={acao}>
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <div className="grade-form">
        <label className="campo campo-largo">Nome da campanha<input type="text" name="nome" defaultValue={c.nome || ''} required placeholder="ex.: Arrancada de Novembro" /></label>
        <label className="campo">Início<input type="date" name="data_inicio" defaultValue={c.data_inicio || ''} required /></label>
        <label className="campo">Fim<input type="date" name="data_fim" defaultValue={c.data_fim || ''} required /></label>
        <label className="campo">Quem participa
          <select name="participacao" defaultValue={c.participacao || 'colaborador'}>
            <option value="colaborador">Colaboradores (individual)</option>
            <option value="equipe">Equipes</option>
          </select>
        </label>
        <label className="campo">Como conta o alvo
          <select name="modo" defaultValue={c.modo || 'individual'}>
            <option value="individual">Cada participante precisa atingir</option>
            <option value="coletiva">Soma de todos (meta coletiva)</option>
          </select>
        </label>
        <label className="campo">Visual padrão
          <select name="tema" defaultValue={c.tema || 'corrida'}>
            {Object.entries(TEMAS).map(([k, t]) => <option key={k} value={k}>{t.emoji} {t.nome}</option>)}
          </select>
        </label>
        <label className="campo">Prêmio<input type="text" name="premio" defaultValue={c.premio || ''} placeholder="ex.: Vale-presente de R$ 300" /></label>
        <label className="campo campo-largo">Regras<textarea name="regras" rows={3} defaultValue={c.regras || ''} placeholder="ex.: Valem só vendas novas com ativação até o último dia. Combo conta como 1 móvel + 1 fibra." /></label>
      </div>
      {comItens && (
        <fieldset className="lider-equipes" style={{ maxHeight: 'none' }}>
          <legend>O que precisa ser vendido (preencha só as linhas que usar)</legend>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="campos" style={{ marginBottom: 6 }}>
              <input type="text" name={`item_nome_${i}`} placeholder={['Móveis', 'Fibras', 'Combos', 'Aparelhos', '', ''][i]} aria-label={`Item ${i + 1}`} style={{ width: 200 }} />
              <input type="text" name={`item_alvo_${i}`} placeholder="alvo" inputMode="decimal" aria-label={`Alvo do item ${i + 1}`} style={{ width: 90 }} />
              <select name={`item_unidade_${i}`} aria-label={`Medida do item ${i + 1}`}><option value="qtd">quantidade</option><option value="brl">R$</option></select>
            </div>
          ))}
        </fieldset>
      )}
      <button className="btn" type="submit" style={{ marginTop: 12 }}>{botao}</button>
    </FormAcao>
  );
}
