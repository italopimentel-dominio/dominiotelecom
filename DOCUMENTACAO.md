# Metas da Equipe: documentação

Sistema para cadastrar e acompanhar as metas de Televendas, Consultivo e Indireto, substituindo a planilha "Meta [mês]".

Stack: Next.js 15 (App Router) + Supabase (banco e login) + Vercel (hospedagem) + GitHub (código, deploy automático a cada commit na `main`).

## Como o sistema é organizado

**Canais e equipes (árvore).** Tudo é um "grupo" que pode ficar dentro de outro: `Televendas > São Paulo > Paloma SP`. Não há limite de níveis. A meta é lançada só nas equipes da ponta (ex.: supervisores, Indireto). Quem tem equipes ativas abaixo (regionais e canais) tem a meta calculada como **soma** delas: Campinas = soma dos supervisores de Campinas, Televendas = Campinas + São Paulo + Inbound. Na tela Metas essas linhas aparecem em negrito, sem campo para digitar.

**Admissão e desligamento.** Desligar um colaborador pede a data de desligamento. Em cada mês, o colaborador só aparece se esteve na casa em algum dia daquele mês (entre admissão e desligamento); meses anteriores continuam mostrando a pessoa e os resultados dela normalmente. Quem entra ou sai no meio do fechamento recebe meta proporcional aos dias úteis em que esteve na casa (ex.: entrou dia 16, 11 de 21 dias úteis = 52% da cota), sem precisar mexer no peso. O realizado de quem saiu continua somando na equipe. Reativar apaga a data de desligamento.

**Colaboradores.** Pertencem a um grupo, têm data de admissão (o sistema mostra o tempo de casa no cadastro, na tela da equipe e na página do colaborador; quem tem menos de 3 meses aparece como "novo") e têm um **peso** (1 = cota cheia, 0,5 = meia cota, 0 = sem meta). A meta do grupo é dividida entre os colaboradores ativos do próprio grupo, proporcional ao peso. Na tela da equipe dá para **fixar** a meta de alguém; o restante é dividido entre os outros. Em produtos de quantidade a divisão usa números inteiros que somam exatamente a meta.

**Realizado.** Lançado por colaborador (tela da equipe). Para grupos sem colaboradores (ex.: Indireto) é lançado direto no grupo. O realizado de um grupo é a soma de tudo que está abaixo dele.

**Produtos.** Têm medida (quantidade ou R$) e um código de **fechamento** (ex.: `GERAL`, `FIBRA`).

**Novo mês.** Na tela Metas, em "Criar metas de outro mês": escolha o mês e de qual mês copiar as metas (inclusive as metas fixas de colaboradores); o sistema cria e já abre o mês novo. Também dá para copiar metas de outro mês para o mês aberto. Na grade, o cabeçalho dos produtos e a coluna de equipes ficam fixos ao rolar.

**Dentro/fora da meta.** Na tela da equipe, abaixo da quantidade de colaboradores ativos, aparece quantos estão dentro da meta (já bateram ou estão no ritmo esperado até hoje) e fora (abaixo do ritmo), em quantidade e percentual, no produto selecionado, contando também as equipes abaixo.

**Períodos e fechamentos.** Cada mês é um período. Ao criar o mês, o sistema cria um fechamento para cada código usado pelos produtos, do dia 1 ao último dia do mês; ajuste as datas se Fibra fechar em outro dia. O acréscimo da necessidade bruta (padrão 30%) é configurado por mês.

**Feriados.** Os nacionais são calculados automaticamente para qualquer ano (incluindo Sexta-feira Santa, Carnaval e Corpus Christi, que dependem da Páscoa, e Consciência Negra). Em "Feriados" é possível:
- ligar/desligar Carnaval e Corpus Christi e considerar sábado como dia útil;
- cadastrar feriados estaduais/municipais para todos ou só para uma equipe (vale também para as equipes abaixo dela);
- cadastrar "dia útil extra" (sábado trabalhado, feriado em que a operação funciona).

**Menu lateral.** O botão no topo do menu recolhe a barra para uma faixa só de ícones (passe o mouse para ver o nome); a escolha fica salva no navegador. Os cadastros (equipes, produtos, períodos, feriados, usuários) ficam agrupados em "Cadastros", que abre e fecha. Minha senha e Sair ficam no rodapé, ao lado do nome.

**Organograma.** Menu próprio com a estrutura comercial desenhada: Comercial Duomni > canais > regionais > equipes, com os colaboradores ativos dentro de cada equipe (primeiro e último nome, cor por pessoa, etiqueta "novo" para menos de 3 meses). Abas por canal, zoom (−, +, ajustar à tela) e impressão (Ctrl+P esconde o menu). Clicar numa equipe ou pessoa abre as metas dela. É montado automaticamente a partir do cadastro de equipes e colaboradores.

Há duas visões: **Por liderança** (padrão, quando há cargos cadastrados) e **Por canal** (estrutura de metas). Na visão por liderança, em **Editar cargos** (Editor/Administrador) você cadastra as pessoas de liderança (nome, cargo, a quem responde, admissão) e marca quais equipes cada uma lidera diretamente; os colaboradores dessas equipes aparecem dentro do cartão do líder. Exemplo: Diretor comercial > Gerente de Campinas > (Supervisor consultivo, que lidera Consultivo/Campinas) e (Coordenador de televendas > Supervisores de televendas, cada um liderando a sua equipe). Os cargos não mexem nas metas. Equipes com gente e sem líder vinculado aparecem numa lista abaixo do desenho para não ficarem esquecidas.

**Colaboradores.** Na tela de cada equipe, o nome do colaborador abre a página dele, com meta individual, realizado e ritmo de cada produto.

**Importar resultados (Excel/CSV).** Menu Importar resultados, só para Editor e Administrador:
1. Escolha o período e o arquivo (.xlsx, .xls ou .csv, inclusive CSV com ponto e vírgula).
2. O sistema acha sozinho a linha do cabeçalho, a coluna de nome, a de equipe (opcional) e a coluna de cada produto, comparando os nomes (ex.: "ALTAS MÓVEIS" = "Alta Móvel"). Tudo pode ser ajustado.
3. Escolha entre substituir o realizado (planilha com o acumulado do mês) ou somar (planilha de um dia/semana).
4. Cada nome da planilha aparece como Encontrado, Nome parecido (confira), Mais de um com esse nome ou Não cadastrado. Para cada um: vincular a um colaborador existente, cadastrar como novo (escolhendo a equipe) ou ignorar. Há atalho para cadastrar todos os não cadastrados numa equipe.
5. Linhas repetidas do mesmo nome são somadas; linhas que começam com "Total" são ignoradas.
6. Quando um nome diferente é vinculado (ex.: "JOAO S." a "João Silva"), o sistema guarda esse apelido e reconhece sozinho na próxima importação (tabela `colaborador_apelidos`).

O arquivo é lido no navegador; só os números conferidos são enviados ao banco.

## Headcount

Menu Headcount: fotografia do mês escolhido, calculada pelas datas de admissão e desligamento. Mostra quantos começaram o mês, admissões, desligamentos, com quantos fecha o mês e o % perdido (desligamentos ÷ início), ao lado de quantos bateram a meta e quantos estão dentro do ritmo (n e %) no produto escolhido. Tabela por canal, regional e equipe, e a lista de nomes de quem entrou e saiu. A tela de cada equipe também mostra essa linha resumida. Limite: quem mudou de equipe aparece na equipe atual.

## Campanhas

Menu Campanhas, para desafios com regras próprias (independentes das metas):
- **Cadastro:** nome, datas, prêmio, regras (texto), quem participa (colaboradores ou equipes), se o alvo é de cada participante ou a soma de todos (coletiva), e os itens com alvo (ex.: Móveis 10, Fibras 5). Itens são texto livre.
- **Participantes:** inclua uma equipe inteira (pega todos os ativos dela e das de baixo) ou pessoa por pessoa.
- **Resultados:** lançados à mão numa grade participante x item (acumulado).
- **Visuais (troca com um clique, sem perder nada):** 🏁 Corrida (carrinhos numa pista até a bandeira quadriculada), 🚀 Foguete (foguetes subindo até a lua), 🏆 Pódio (top 3 com medalhas e ranking), 🌡️ Termômetro (meta coletiva enchendo). Confete quando alguém completa. O progresso de cada um é a média do % atingido em cada item.
- **Modo TV:** tela cheia para deixar numa TV da operação, atualiza sozinha a cada minuto.

Permissão: todos veem; Editor e Administrador criam e lançam.

## Controle Indireto

Menu próprio para acompanhar os parceiros do canal Indireto.

- **Parceiros:** nome fantasia, razão social/nome completo, CPF ou CNPJ (validado; o sistema reconhece pelo número de dígitos), data de ativação (preenchida com a data do dia ao marcar como Ativo, se estiver vazia), código/PDV, status (prospecção, em onboarding, ativo, inativo), cidade/UF, endereço, contato, telefone, e-mail, ponto focal responsável, início da parceria e observações.
- **Treinamentos:** onboarding, telecom e serviços, cada um com data, status (agendado, realizado, cancelado), quem aplicou e observação. A situação de cada tipo aparece como Realizado, Agendado, Sem registro (agendado com data passada) ou Pendente.
- **Apontamentos:** histórico de anotações do ponto focal, com autor, data e hora. Não dá para editar depois; só quem escreveu (ou um administrador) pode apagar.
- **Histórico de alterações:** toda mudança no cadastro fica registrada no banco (quem, quando, campo, antes e depois), inclusive as feitas pelo formulário. Fica no fim da página do parceiro.
- **Lista:** filtros por busca (nome, cidade, CPF/CNPJ, contato), status, validação, mês de ativação, formulário respondido, ponto focal ("só os meus") e treinamento pendente; resumo no topo e agenda dos próximos 14 dias.

- **Formulário Google de treinamento:** um Apps Script no formulário envia cada resposta para `/api/forms`. O sistema acha o parceiro pelo CPF/CNPJ (ou pelo e-mail) nas respostas e então: marca "Formulário: Respondeu", registra o treinamento como realizado e **valida o parceiro automaticamente**. O gerente pode **desvalidar** depois. Respostas sem parceiro encontrado aparecem na lista, em "Respostas do formulário sem parceiro", para vincular ou ignorar.
- **Validação pelo gerente:** todo parceiro cadastrado por um ponto focal entra como "Aguardando validação". O gerente aprova ou reprova (com motivo obrigatório); a decisão fica registrada nos apontamentos. Se o ponto focal alterar um cadastro já validado ou reprovado, ele volta sozinho para "Aguardando validação". Essas regras ficam no banco: só gerente/administrador consegue mudar a validação.

Permissão própria (tela Usuários, coluna Controle Indireto), independente da permissão de metas:

| Permissão | Pode |
|---|---|
| Sem acesso | não vê o menu |
| Visualiza | consulta |
| Ponto focal (cadastra) | cadastra parceiros, treinamentos e apontamentos |
| Gerente (valida) | tudo do ponto focal + aprova ou reprova cadastros |

Administrador pode tudo, inclusive excluir parceiros.

### Configurar o Formulário Google

1. Na Vercel, crie a variável `FORMS_WEBHOOK_SECRET` com um texto longo inventado (ex.: `duomni-forms-8f3k2...`) e faça Redeploy.
2. No formulário, garanta uma pergunta de **CPF ou CNPJ** (é por ela que o parceiro é encontrado).
3. No editor do formulário: ⋮ > **Editor de scripts**. Apague o conteúdo e cole o arquivo `integracoes-google-forms.gs`. Troque `SEGREDO` pelo mesmo texto do passo 1 e, se precisar, `TIPO_TREINAMENTO` (onboarding, telecom ou servicos) e `URL_SISTEMA`. Salve.
4. Em **Acionadores** (relógio): Adicionar acionador > função `aoEnviar` > origem "Do formulário" > evento "Ao enviar formulário". Autorize com a conta dona do formulário.
5. Para as respostas que já existem: selecione `enviarTodas` e clique em Executar uma vez. Respostas repetidas são ignoradas.

Se houver um formulário para cada treinamento, repita os passos em cada um, mudando `TIPO_TREINAMENTO`.

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
    organograma/    Organograma comercial
    indireto/       Controle Indireto (lista, novo, [id] = página do parceiro)
    grupos/[id]/    Detalhe da equipe: semanas, colaboradores, realizado
    metas/          Grade de metas do mês (grupo x produto)
    estrutura/      Canais, equipes e colaboradores
    produtos/  periodos/  feriados/  usuarios/  conta/
  actions/          Server actions (gravação): auth.js, dados.js, usuarios.js
  login/  setup/
components/         FormAcao, CampoNumero (salva ao sair do campo), BarraRitmo, MenuLateral, Importador, FormParceiro...
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
  005_validacao_parceiros.sql Validação dos cadastros pelo gerente
  006_formulario_historico.sql CPF, data de ativação, histórico e Formulário Google
  007_admissao.sql          Data de admissão dos colaboradores
  008_liderancas.sql        Cargos de liderança do organograma
  009_desligamento.sql      Data de desligamento dos colaboradores
  010_campanhas.sql         Campanhas comerciais
integracoes-google-forms.gs  Script para colar no Formulário Google
app/api/forms/route.js       Recebe as respostas do formulário
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
   - `FORMS_WEBHOOK_SECRET` (para o Formulário Google)
4. Abrir `https://SEU-SITE.vercel.app/setup` e criar o administrador.

Se o Supabase recusar o e-mail interno ao criar usuário, preencha o campo e-mail ou troque `LOGIN_EMAIL_DOMAIN` por um domínio real da empresa (nenhum e-mail é enviado).

## Ideias para próximas versões

- Lançamento diário do realizado (histórico dia a dia e gráfico de evolução).
- Colaborador com login próprio vendo só a própria meta.
- Histórico de equipe do colaborador (hoje, se mudar de equipe, o realizado de meses antigos acompanha a equipe nova).
- Exportar o painel para Excel/PDF.
