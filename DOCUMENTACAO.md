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

**Menu lateral.** O botão no topo do menu recolhe a barra para uma faixa só de ícones (passe o mouse para ver o nome); a escolha fica salva no navegador. Os cadastros (equipes, produtos, períodos, feriados, usuários) ficam agrupados em "Cadastros", que abre e fecha. Minha senha e Sair ficam no rodapé, ao lado do nome.

**Menu em árvore.** Na barra lateral, a seção Equipes (que também abre e fecha) mostra canais, regionais, equipes e colaboradores em níveis que abrem e fecham (▶). Tem busca por nome. Clicar numa equipe abre o detalhe dela; clicar num colaborador abre a página dele, com meta individual, realizado e ritmo de cada produto. A ordem dos níveis segue o cadastro em "Equipes e colaboradores" (campo "Fica dentro de").

**Importar resultados (Excel/CSV).** Menu Importar resultados, só para Editor e Administrador:
1. Escolha o período e o arquivo (.xlsx, .xls ou .csv, inclusive CSV com ponto e vírgula).
2. O sistema acha sozinho a linha do cabeçalho, a coluna de nome, a de equipe (opcional) e a coluna de cada produto, comparando os nomes (ex.: "ALTAS MÓVEIS" = "Alta Móvel"). Tudo pode ser ajustado.
3. Escolha entre substituir o realizado (planilha com o acumulado do mês) ou somar (planilha de um dia/semana).
4. Cada nome da planilha aparece como Encontrado, Nome parecido (confira), Mais de um com esse nome ou Não cadastrado. Para cada um: vincular a um colaborador existente, cadastrar como novo (escolhendo a equipe) ou ignorar. Há atalho para cadastrar todos os não cadastrados numa equipe.
5. Linhas repetidas do mesmo nome são somadas; linhas que começam com "Total" são ignoradas.
6. Quando um nome diferente é vinculado (ex.: "JOAO S." a "João Silva"), o sistema guarda esse apelido e reconhece sozinho na próxima importação (tabela `colaborador_apelidos`).

O arquivo é lido no navegador; só os números conferidos são enviados ao banco.

## Controle Indireto

Menu próprio para acompanhar os parceiros do canal Indireto.

- **Parceiros:** nome fantasia, razão social, CNPJ (validado), código/PDV, status (prospecção, em onboarding, ativo, inativo), cidade/UF, endereço, contato, telefone, e-mail, ponto focal responsável, início da parceria e observações.
- **Treinamentos:** onboarding, telecom e serviços, cada um com data, status (agendado, realizado, cancelado), quem aplicou e observação. A situação de cada tipo aparece como Realizado, Agendado, Sem registro (agendado com data passada) ou Pendente.
- **Apontamentos:** histórico de anotações do ponto focal, com autor, data e hora. Não dá para editar depois; só quem escreveu (ou um administrador) pode apagar.
- **Lista:** filtros por busca (nome, cidade, CNPJ, contato), status, ponto focal ("só os meus") e treinamento pendente; resumo no topo e agenda dos próximos 14 dias.

Permissão própria (tela Usuários, coluna Controle Indireto): Sem acesso, Visualiza ou Ponto focal (edita). É independente da permissão de metas: um Visualizador de metas pode ser ponto focal do Indireto. Administrador pode tudo, inclusive excluir parceiros.

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
  actions/indireto.js  Gravação do Controle Indireto
  (app)/            telas que exigem login
    page.js         Painel (por canal, com todos os níveis)
    colaboradores/[id]/  Página do colaborador
    importar/       Importação de resultados por Excel/CSV
    indireto/       Controle Indireto (lista, novo, [id] = página do parceiro)
    grupos/[id]/    Detalhe da equipe: semanas, colaboradores, realizado
    metas/          Grade de metas do mês (grupo x produto)
    estrutura/      Canais, equipes e colaboradores
    produtos/  periodos/  feriados/  usuarios/  conta/
  actions/          Server actions (gravação): auth.js, dados.js, usuarios.js
  login/  setup/
components/         FormAcao, CampoNumero (salva ao sair do campo), BarraRitmo, MenuLateral, ArvoreMenu, Importador, FormParceiro...
lib/
  calc.js           Dias úteis, semanas, indicadores, divisão da meta
  feriados.js       Feriados nacionais (cálculo da Páscoa)
  nomes.js          Comparação de nomes (sem acento, nomes parecidos)
  indireto.js       Status, tipos de treinamento, CNPJ
  dados.js          Leitura do banco e montagem da árvore
  datas.js  formato.js  auth.js  supabase/
supabase/
  001_estrutura.sql         Tabelas, segurança, dados iniciais (rodar 1 vez)
  002_exemplo_outubro.sql   Opcional: Outubro/2026 com as metas da planilha
  003_importacao.sql        Tabela de apelidos usada na importação
  004_controle_indireto.sql Parceiros, treinamentos, apontamentos e permissão do módulo
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
- Colaborador com login próprio vendo só a própria meta.
- Histórico de equipe do colaborador (hoje, se mudar de equipe, o realizado de meses antigos acompanha a equipe nova).
- Exportar o painel para Excel/PDF.
