# Metas da Equipe: documentação

Sistema para cadastrar e acompanhar as metas de Televendas, Consultivo e Indireto, substituindo a planilha "Meta [mês]".

Stack: Next.js 15 (App Router) + Supabase (banco e login) + Vercel (hospedagem) + GitHub (código, deploy automático a cada commit na `main`).

## Como o sistema é organizado

**Canais e equipes (árvore).** Tudo é um "grupo" que pode ficar dentro de outro: `Televendas > São Paulo > Paloma SP`. Não há limite de níveis. Cada grupo pode ter meta própria para cada produto, como na planilha (a meta da regional não precisa ser a soma das equipes).

**Colaboradores.** Pertencem a um grupo e têm um **peso** (1 = cota cheia, 0,5 = meia cota, 0 = sem meta). A meta do grupo é dividida entre os colaboradores ativos do próprio grupo, proporcional ao peso. Na tela da equipe dá para **fixar** a meta de alguém; o restante é dividido entre os outros. Em produtos de quantidade a divisão usa números inteiros que somam exatamente a meta.

**Realizado.** Lançado por colaborador (tela da equipe). Para grupos sem colaboradores (ex.: Indireto) é lançado direto no grupo. O realizado de um grupo é a soma de tudo que está abaixo dele.

**Produtos.** Têm medida (quantidade ou R$) e um código de **fechamento** (ex.: `GERAL`, `FIBRA`).

**Períodos e fechamentos.** Cada mês é um período. Ao criar o mês, o sistema cria um fechamento para cada código usado pelos produtos, do dia 1 ao último dia do mês; ajuste as datas se Fibra fechar em outro dia. O acréscimo da necessidade bruta (padrão 30%) é configurado por mês.

**Feriados.** Os nacionais são calculados automaticamente para qualquer ano (incluindo Sexta-feira Santa, Carnaval e Corpus Christi, que dependem da Páscoa, e Consciência Negra). Em "Feriados" é possível:
- ligar/desligar Carnaval e Corpus Christi e considerar sábado como dia útil;
- cadastrar feriados estaduais/municipais para todos ou só para uma equipe (vale também para as equipes abaixo dela);
- cadastrar "dia útil extra" (sábado trabalhado, feriado em que a operação funciona).

## Cálculos

Para cada grupo e produto, dentro do fechamento do produto:

| Indicador | Fórmula |
|---|---|
| Dias úteis | dias entre início e fim do fechamento, sem domingo, sábado (se não for útil) e feriados |
| Decorridos / restantes | dias úteis antes de hoje / a partir de hoje (hoje conta como restante) |
| % realizado | realizado ÷ meta |
| Esperado até hoje | dias úteis decorridos ÷ dias úteis totais (o tracinho preto na barra) |
| Falta (necessidade líquida) | meta − realizado (mínimo 0) |
| Falta bruta | falta × fator do mês (ex.: 1,30), arredondado para cima em quantidade |
| Por dia útil | falta ÷ dias úteis restantes |
| Necessidade da semana | falta repartida pelos dias úteis restantes de cada semana (seg a dom) |
| Planejado da semana | meta repartida pelos dias úteis de cada semana (visão do início do mês) |
| Projeção | realizado ÷ dias decorridos × dias totais |

Status da barra: **No ritmo** (% realizado ≥ esperado), **Atenção** (≥ 85% do esperado), **Abaixo do ritmo** (< 85%), **Meta batida**.

Fuso horário: "hoje" é sempre o dia em São Paulo.

## Permissões

| Papel | Pode |
|---|---|
| Visualizador (padrão) | ver tudo |
| Editor | ver + lançar metas, realizado, cadastrar equipes, colaboradores, produtos, períodos e feriados |
| Administrador | tudo do Editor + criar, inativar/reativar usuários, mudar permissões e redefinir senhas |

- Login por **usuário** e senha. Se não informar e-mail, o sistema cria um interno (`usuario@metas.local`), só para o Supabase.
- O primeiro usuário (criado em `/setup`) vira Administrador automaticamente. A tela `/setup` só funciona enquanto não existir nenhum usuário.
- Inativar um usuário bloqueia o login no Supabase na hora e esconde os dados dele.
- As permissões são garantidas no banco (Row Level Security), não só na tela.
- Contas criadas fora do painel (cadastro público do Supabase) entram inativas. Mesmo assim, desligue o cadastro público (passo 1 abaixo).

## Pastas

```
app/
  (app)/            telas que exigem login
    page.js         Painel (por canal, com todos os níveis)
    grupos/[id]/    Detalhe da equipe: semanas, colaboradores, realizado
    metas/          Grade de metas do mês (grupo x produto)
    estrutura/      Canais, equipes e colaboradores
    produtos/  periodos/  feriados/  usuarios/  conta/
  actions/          Server actions (gravação): auth.js, dados.js, usuarios.js
  login/  setup/
components/         FormAcao, CampoNumero (salva ao sair do campo), BarraRitmo...
lib/
  calc.js           Dias úteis, semanas, indicadores, divisão da meta
  feriados.js       Feriados nacionais (cálculo da Páscoa)
  dados.js          Leitura do banco e montagem da árvore
  datas.js  formato.js  auth.js  supabase/
supabase/
  001_estrutura.sql         Tabelas, segurança, dados iniciais (rodar 1 vez)
  002_exemplo_outubro.sql   Opcional: Outubro/2026 com as metas da planilha
middleware.js       Redireciona para /login quem não está logado
```

## Banco (Supabase)

`profiles` (usuários), `config` (regras do calendário), `produtos`, `grupos`, `colaboradores`, `periodos`, `ciclos` (fechamentos), `metas`, `metas_individuais` (metas fixadas), `realizados`, `realizados_grupo`, `feriados`. Metas e realizados guardam `atualizado_em` e `atualizado_por`.

## Colocar no ar (sem terminal)

1. **Supabase**: criar projeto (região São Paulo). Em *SQL Editor*, colar e rodar `supabase/001_estrutura.sql`; depois, se quiser, `002_exemplo_outubro.sql`. Em *Authentication > Sign In / Providers*, **desligar "Allow new users to sign up"**. Em *Project Settings > API* copiar: Project URL, chave anon/publishable e chave service_role/secret.
2. **GitHub**: criar repositório privado, clicar em *uploading an existing file* e arrastar o conteúdo da pasta do projeto.
3. **Vercel**: *Add New > Project*, importar o repositório e cadastrar as variáveis:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (secreta, nunca com prefixo NEXT_PUBLIC)
   - `LOGIN_EMAIL_DOMAIN` (opcional)
4. Abrir `https://SEU-SITE.vercel.app/setup` e criar o administrador.

Se o Supabase recusar o e-mail interno ao criar usuário, preencha o campo e-mail ou troque `LOGIN_EMAIL_DOMAIN` por um domínio real da empresa (nenhum e-mail é enviado).

## Ideias para próximas versões

- Lançamento diário do realizado (histórico dia a dia e gráfico de evolução).
- Importar realizado de planilha/CSV.
- Colaborador com login próprio vendo só a própria meta.
- Histórico de equipe do colaborador (hoje, se mudar de equipe, o realizado de meses antigos acompanha a equipe nova).
- Exportar o painel para Excel/PDF.
