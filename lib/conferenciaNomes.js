import { normalizar, similaridade } from './nomes';

// Decide se um nome vindo de planilha já existe no cadastro.
// situacao: encontrado | parecido | ambiguo | novo
export function classificarNome(original, equipeTexto, { colaboradores, mapaApelidos, grupos }) {
  const chave = normalizar(original);
  const viaApelido = mapaApelidos.get(chave);
  if (viaApelido && colaboradores.some((c) => c.id === viaApelido)) return { situacao: 'encontrado', sugerido: viaApelido };
  const exatos = colaboradores.filter((c) => normalizar(c.nome) === chave);
  const ativos = exatos.filter((c) => c.ativo);
  if (exatos.length === 1) return { situacao: 'encontrado', sugerido: exatos[0].id };
  if (ativos.length === 1) return { situacao: 'encontrado', sugerido: ativos[0].id };
  if (exatos.length > 1) return { situacao: 'ambiguo', sugerido: '', opcoes: exatos.map((c) => c.id) };
  let melhor = null, nota = 0;
  colaboradores.forEach((c) => {
    const s = similaridade(original, c.nome) + (c.ativo ? 0.01 : 0);
    if (s > nota) { nota = s; melhor = c; }
  });
  if (melhor && nota >= 0.72) return { situacao: 'parecido', sugerido: melhor.id };
  return { situacao: 'novo', sugerido: '', grupoSugerido: sugerirGrupo(equipeTexto, grupos) };
}

// Acha a equipe do sistema mais parecida com um texto ("EQUIPE VITOR HENRIQUE", "CANAL INDIRETO")
export function sugerirGrupo(texto, grupos) {
  if (!texto) return '';
  const limpo = String(texto).replace(/^(equipe|canal)\s+/i, '');
  let melhor = '', nota = 0;
  const primeiro = normalizar(limpo).split(' ')[0];
  grupos.forEach((g) => {
    const ultimo = g.nome.split(' / ').pop();
    let s = Math.max(similaridade(limpo, ultimo), similaridade(texto, g.nome), g.lider ? similaridade(limpo, g.lider) : 0);
    // "PALOMA MICKAELA ..." x "Paloma SP": mesmo primeiro nome
    const primeiroGrupo = normalizar(ultimo).split(' ')[0];
    if (primeiro.length >= 4 && primeiro === primeiroGrupo) s = Math.max(s, 0.8);
    if (g.lider && primeiro.length >= 4 && primeiro === normalizar(g.lider).split(' ')[0]) s = Math.max(s, 0.78);
    if (s > nota) { nota = s; melhor = g.id; }
  });
  return nota >= 0.7 ? melhor : '';
}
