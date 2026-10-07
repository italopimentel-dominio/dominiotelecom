// Ícones simples em SVG (traço), sem dependências.
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

const desenhos = {
  painel: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  metas: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  importar: <path d="M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />,
  indireto: <path d="M3 9l1.5-5h15L21 9M3 9h18M5 9v11h14V9M10 20v-6h4v6" />,
  equipes: <><circle cx="9" cy="7" r="3" /><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" /><circle cx="17" cy="8" r="2.5" /><path d="M16 14.2c2.8.2 5 1.7 5 4.8" /></>,
  produtos: <path d="M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10" />,
  periodos: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  feriados: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  usuarios: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  senha: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></>,
  sair: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  cadastros: <><path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1" /><circle cx="16" cy="6" r="2.5" /><circle cx="10" cy="12" r="2.5" /><circle cx="18" cy="18" r="2.5" /></>,
  organograma: <><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-4h12v4" /></>,
  campanhas: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />,
  headcount: <><circle cx="12" cy="7" r="3" /><path d="M6 21v-2a6 6 0 0 1 12 0v2M3 11h3M18 11h3" /></>,
  quadro: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M9 9v11M15 9v11" /></>,
  resumo: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  preparador: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  materiais: <path d="M4 4h12l4 4v12H4zM8 12h8M8 16h5M15 4v5h5" />,
  fonte: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></>,
  recolher: <path d="M15 18l-6-6 6-6" />,
  expandir: <path d="M9 18l6-6-6-6" />,
};

export default function Icone({ nome }) {
  return <svg {...base}>{desenhos[nome]}</svg>;
}
