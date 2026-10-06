# Duomni | Metas e Controle: documentação

> **Para continuar em uma conversa nova:** envie este arquivo e o último `metas-equipe.zip`. Tudo o que é preciso para continuar de onde parou está aqui: como o sistema funciona, onde fica cada coisa, regras de negócio, banco e forma de publicar.

Sistema web da Duomni (Vivo, canal direto e indireto) para metas e resultados das equipes **Consultivo, Televendas e Indireto**. Substituiu a planilha "Meta [mês]".

---

## 1. Visão geral

| Item | Valor |
|---|---|
| Site | `https://dominiotelecom.vercel.app` |
| Código | GitHub, repositório `dominiotelecom` (conta italopimentel-dominio) |
| Banco e login | Supabase, projeto `ggtmjlklfmggdtrlnews` (plano gratuito: pausa após 7 dias sem uso) |
| Hospedagem | Vercel (plano Hobby), deploy automático a cada commit na `main` |
| Tecnologia | Next.js 15.5 (App Router, JavaScript, Server Actions), React 19, `@supabase/ssr`, SheetJS (`xlsx` 0.18.5), CSS próprio (sem Tailwind) |
| Identidade | Roxo `#6B40E7`, menu `#121018`, fontes Outfit (títulos) e Archivo (texto). Logos em `public/` |

### 1.1 Como o dono do projeto publica

O usuário **não usa terminal**. O fluxo é:

1. Claude entrega um `metas-equipe.zip` com o projeto inteiro (sem `node_modules` e `.next`) e, quando houver, um arquivo `supabase/0NN_*.sql`.
2. **SQL primeiro:** o usuário roda o SQL novo no SQL Editor do Supabase.
3. **Depois o zip:** o usuário sobe o zip no GitHub ("Add file > Upload files"). Uma GitHub Action (`.github/workflows/descompactar.yml`, criada pelo usuário, **não vem no zip**) descompacta, apaga o zip e faz commit. A Vercel publica sozinha.
4. Arquivos que existem no GitHub e não estão no zip (a Action, `vercel.json` com `{ "framework": "nextjs" }`) **continuam lá**: a Action só copia por cima.

Regras de trabalho para Claude:
- Sempre rodar `next build` antes de entregar, com variáveis falsas. Testar regras de negócio com scripts Node em `/tmp`. Testar SQL num Postgres local com um mock de `auth.users`, `auth.uid()` e dos papéis `authenticated`, `anon` e `service_role` (com `bypassrls`), rodando duas vezes para garantir que pode repetir.
- **Zip sempre com mais de um item na raiz** (ex.: `app/` + `DOCUMENTACAO.md`). Se o zip tiver uma pasta só na raiz, a Action tira essa pasta e os arquivos caem no lugar errado (aconteceu com `app/(app)/...` virando `(app)/...` na raiz).
- SQL sempre **aditivo e repetível** (`if not exists`, `drop policy if exists`). Nunca apagar dados existentes.
- Dizer claramente se a entrega tem SQL e em que ordem. O usuário sempre pergunta se "vai desconfigurar algo": responder com o que muda na tela e o que muda nos dados.
- Respostas em português, diretas.

### 1.2 Variáveis de ambiente (Vercel)

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ggtmjlklfmggdtrlnews.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave publishable/anon |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secreta (só servidor; usada para usuários, upload de imagens e webhook) |
| `LOGIN_EMAIL_DOMAIN` | opcional; domínio do e-mail interno de quem não tem e-mail (padrão `metas.local`) |
| `FORMS_WEBHOOK_SECRET` | segredo combinado com o Apps Script do Formulário Google |

### 1.3 SQL (ordem de execução, todos já rodados até o 018)

| Arquivo | O que faz |
|---|---|
| 001_estrutura | tabelas base, RLS, perfis, produtos e grupos iniciais, grants |
| 002_exemplo_outubro | opcional: período de exemplo com metas da planilha antiga |
| 003_importacao | `colaborador_apelidos` (nome da planilha → colaborador) |
| 004_controle_indireto | parceiros, treinamentos, apontamentos, `profiles.perm_indireto` |
| 005_validacao_parceiros | validação pelo gerente (permissão `validar`) |
| 006_formulario_historico | CPF, data de ativação, histórico de parceiro, respostas do Formulário Google |
| 007_admissao | `colaboradores.data_admissao` |
| 008_liderancas | cargos de liderança do organograma |
| 009_desligamento | `colaboradores.data_desligamento` |
| 010_campanhas | campanhas comerciais |
| 011_personalizacao | visual das campanhas, `colaboradores.foto_url`, bucket público `midia` |
| 012_produto_soma | produto do tipo soma + `produto_componentes` |
| 013_meta_empresa | `metas_empresa` (meta "de cima" por indicador e mês) |
| 014_indicadores_resumo | `config.resumo_produtos` (indicadores escolhidos no Resumo) |
| 015_quantidade_e_receita | coluna `medida` (qtd/brl) nas tabelas de valores; `produtos.medidas` |
| 016_historico_equipes | `colaborador_equipes` (equipe por mês) |
| 017_fonte_dados | `fontes_dados`, `sincronizacoes`, `periodos.fechado` |
| 018_nome_para_equipe | `apelidos_equipe` (nome da planilha lançado direto numa equipe) |
| 019_status_venda_parceiros | `parceiro_status` (lista editável), venda vinculada (`parceiros.venda_*`), `ativacao_travada_em`, `nome_normalizado()`, RPCs `registrar_vendas_parceiros` e `desfazer_vendas_parceiros` |
| 020_importar_parceiros_indireto | importação única da planilha "Indireto - Acompanhamento Diário Parceiros" (101 parceiros, 190 treinamentos) |

O próximo SQL deve ser o **019**.

---

## 2. Permissões

**Metas** (`profiles.papel`):

| Papel | Pode |
|---|---|
| `viewer` (Visualizador, padrão) | ver |
| `editor` (Editor) | ver e lançar: metas, resultados, cadastros, importações, fonte de dados, campanhas, organograma |
| `admin` (Administrador) | tudo, mais usuários e o Preparador de material |

**Controle Indireto** (`profiles.perm_indireto`, independente do papel de metas): `nenhum`, `ver`, `editar` (ponto focal, cadastra) e `validar` (gerente, aprova ou reprova). O administrador pode tudo.

Funções SQL usadas nas regras de segurança (RLS): `usuario_ativo()`, `pode_editar()`, `eh_admin()`, `pode_ver_indireto()`, `pode_editar_indireto()`, `pode_validar_indireto()` e `papel_requisicao()` (lê a role do JWT). Padrão das tabelas: leitura para usuário ativo, escrita para `pode_editar()`.

**Login:** usuário e senha. O e-mail interno é `usuario@LOGIN_EMAIL_DOMAIN`, achado pela RPC `email_do_usuario`. O primeiro usuário criado em `/setup` vira administrador. Contas criadas fora do painel entram inativas, e o cadastro público fica desligado no Supabase. Inativar um usuário aplica um *ban* no Auth.

---

## 3. Menu e telas

```
▾ Metas
    Resumo da empresa      /resumo
    Painel                 /            (canais > equipes > produtos)
    Quadro de metas        /metas
    Importar resultados    /importar    (editor)
    Fonte de dados         /fontes      (editor)
    Headcount              /headcount
  Campanhas                /campanhas   (+ /tv/campanha/[id] modo TV)
  Organograma              /organograma (+ /organograma/editar)
  Controle Indireto        /indireto    (se tiver permissão)
  Preparador de material   /preparador  (só admin)
▸ Cadastros
    Equipes e colaboradores /estrutura  (+ /estrutura/[id], /estrutura/nova-pessoa, /estrutura/nova-equipe)
    Produtos               /produtos
    Períodos e fechamentos /periodos
    Feriados               /feriados
    Usuários               /usuarios    (admin)
  rodapé: Minha senha /conta, Sair
```

Outras rotas: `/grupos/[id]` (tela da equipe: semanas, colaboradores, realizado), `/colaboradores/[id]`, `/login`, `/setup`, `/api/forms` (webhook do Formulário Google, público, protegido por segredo).

O menu lateral recolhe para uma faixa só de ícones; a escolha fica no cookie `menu_recolhido`. O botão **# Quantidade | R$ Receita** fica no topo das telas de metas, com a escolha no cookie `medida`.

---

## 4. Modelo de dados (principais)

- **`grupos`**: árvore de canal, unidade e equipe (`parent_id`). Quem tem equipes ativas abaixo tem meta = **soma** das filhas. Só as equipes da ponta recebem meta digitada.
- **`colaboradores`**: `grupo_id` (equipe "base"/atual), `peso` (cota: 1 cheia, 0,5 meia, 0 sem meta), `data_admissao`, `data_desligamento`, `ativo`, `foto_url`.
- **`colaborador_equipes`**: histórico de equipe. "A partir de `desde` (1º dia do mês) a pessoa é do grupo X." A equipe de uma pessoa num mês é o vínculo mais recente com `desde ≤ 1º dia do mês`. Sem vínculos, vale `grupo_id`.
- **`produtos`**: `medidas` (`qtd`, `brl` ou `ambos`), `ciclo` (código do fechamento, ex.: `GERAL`, `FIBRA`), `tipo` (`simples` ou `composto` = soma), `ordem`, `ativo`. **`produto_componentes`** (produto soma → componente, peso).
- **`periodos`** (um por mês, `referencia` = dia 1, `fator_bruto` ex.: 1,30, `fechado`) e **`ciclos`** (fechamentos com datas por código).
- **Valores, todos com `medida` qtd/brl na chave primária:** `metas` (periodo, grupo, produto), `metas_individuais` (meta fixa de colaborador), `realizados` (periodo, colaborador, produto), `realizados_grupo` (resultado lançado direto numa equipe), `metas_empresa` (periodo, produto).
- **`feriados`** (tipo `feriado` ou `dia_util`; `grupo_id` opcional vale para a subárvore) e **`config`** (sábado útil, carnaval, corpus christi, `resumo_produtos`).
- **Nomes:** `colaborador_apelidos` e `apelidos_equipe`.
- **Outros módulos:** `liderancas` + `lideranca_grupos`; `campanhas`, `campanha_itens`, `campanha_participantes`, `campanha_resultados`; `parceiros`, `parceiro_treinamentos`, `parceiro_apontamentos`, `parceiro_historico`, `parceiro_respostas_form`; `fontes_dados`, `sincronizacoes`.

---

## 5. Regras de cálculo (`lib/calc.js`, `lib/dados.js`)

- **Leitura:** `carregarBase(supabase, periodo, medida)` lê tudo de um mês numa medida (com paginação de 1000 linhas) e aplica a equipe daquele mês. `analisar(base)` devolve as funções `meta`, `realizado`, `indicador`, `individuais`, `geralGrupos`, `geralColaboradores`, `composicao` e outras.
- **Dias úteis:** segunda a sexta, menos feriados nacionais (calculados, inclusive Páscoa, Carnaval e Corpus Christi), menos feriados cadastrados, mais "dias úteis extras". Sábado é configurável. "Hoje" é sempre no fuso de São Paulo.
- **Indicadores:**
  - **Falta** = meta − realizado;
  - **Falta bruta** = falta × fator do mês;
  - **Por dia** = falta ÷ dias úteis restantes;
  - **Necessidade por semana** = falta repartida pelos dias úteis restantes de cada semana;
  - **Esperado até hoje** = dias úteis decorridos ÷ dias úteis totais.
- **Status:** **batida** (≥100%); **no ritmo** (% ≥ esperado); **atenção** (≥85% do esperado); **abaixo do ritmo**. A mesma régua vale no Painel, no Resumo e no Headcount.
- **Meta individual:** a meta da equipe é dividida entre os colaboradores **ativos no período**. Cada um recebe pelo peso × parte dos dias úteis em que esteve na casa (admissão e desligamento no meio do mês ficam proporcionais). Metas fixas saem primeiro. Em quantidade, a divisão usa inteiros que somam a meta exata.
- **Colaborador no mês:** aparece se esteve na casa em algum dia do mês. Inativado sem data de desligamento (forma antiga) não aparece em nenhum mês.
- **Produto soma:** o realizado é a soma (com peso) dos componentes. A meta é digitada nele. No Resumo, sem meta própria, a meta distribuída é a soma das metas dos componentes. No Painel, soma **sem meta não aparece**.
- **Meta geral** (Headcount e Resumo): média do % atingido de cada produto com meta, para juntar quantidade e R$ na mesma conta.

---

## 6. Módulos

### Resumo da empresa (`/resumo`)
- **O que mostra:** meta da empresa × meta distribuída (soma do Quadro de metas por canal), folga, % de atingimento por canal com barra de ritmo, e **% de participação** (parte da meta × parte do resultado de cada canal, com ▲ quando traz mais que a parte dele). Um botão abre as unidades e equipes de cada canal.
- **Indicadores:** escolhidos em "⚙ Escolher os indicadores" (vale para todos); sem escolha, aparecem as somas e os produtos fora de soma.
- **Aba Histórico:** últimos 12 meses.

### Painel, Quadro de metas e equipe
- **Quadro de metas:** cabeçalho e primeira coluna fixos; somas em negrito, sem digitação; "Criar metas de outro mês" (cria o mês e copia metas e metas fixas).
- **Tela da equipe (`/grupos/[id]`):** dentro e fora da meta (quantidade e %), headcount resumido, semanas, colaboradores com tempo de casa, meta fixa e realizado editáveis, e composição da soma no ícone ⓘ.

### Importar resultados (`/importar`)
- **Relatório da operadora** (vários arquivos do BI de uma vez):
  - **Formato:** colunas CANAL, mCANAL2 (unidade), mCANAL3 (setor), mCANAL4 (equipe), CONSULTOR, EXECUTADO, M-1, M-2, M-3; linhas "Total" ignoradas.
  - **Detecção automática:** mês e medida pelo rodapé "Filtros aplicados"; produto pelo nome do arquivo ("básica" = fibra, "renova" = reno).
  - **Casos especiais:** inclui consultores independentes; canal sem consultor (CANAL INDIRETO) entra direto numa equipe.
  - **Histórico:** opção de trazer M-1, M-2 e M-3.
  - **Conferência:** "total do relatório × total que entra" antes de gravar.
- **Planilha simples:** uma linha por colaborador, colunas por produto (o cabeçalho com "receita", "valor" ou "R$" vira medida R$).
- **Nomes:** vincular, cadastrar novo, **lançar direto numa equipe** ou ignorar. Os vínculos ficam guardados.

### Fonte de dados (`/fontes`): planilha do Google
- **Fonte:** nome, link (precisa estar "qualquer pessoa com o link pode ver") e em qual produto do sistema entra cada resultado.
- **Leitura:** o servidor baixa em CSV (`/export?format=csv&gid=`) e mostra uma **prévia sem gravar**: meses, totais, nomes para conferir, pendências e a lista "antes → depois".
- **Gravar:** nos meses marcados, os produtos da fonte passam a ser **exatamente** o que está na planilha. Quem não aparece fica zerado, inclusive nas equipes que a fonte alimenta direto. Os valores de antes ficam em `sincronizacoes`.
- **Desfazer:** só a gravação mais recente de cada fonte. **Mês fechado** (`periodos.fechado`) nunca é alterado.
- **Nomes não cadastrados:** "É alguém do cadastro", "Cadastrar agora numa equipe" (com admissão), "Lançar direto numa equipe" (fica lembrado em `apelidos_equipe`) ou "Ignorar". Também há ações em lote.
- **Modelo `pedidos_movel`** (`lib/fontes.js`), da planilha "Cópia Planilha Gerencial":
  - **Colunas:** CONSULTOR, NEO, QUANTIDADE LINHAS, VALOR TERMO SMP (valor da linha), QTD APARELHOS, VALOR APARELHO, EQUIPE CANAL DIRETO, GRUPO CLASSE, GRUPO STATUS, MÊS/ANO CONCLUSÃO (`outubro_2026`).
  - **O que conta:** só `GRUPO STATUS = EXECUTADO`, no mês de MÊS/ANO CONCLUSÃO.
  - **Alta** = ALTA ou MIGRAÇÃO PRÉ/PÓS; **Renovação** = qualquer classe que comece com RENOVAÇÃO (prefixo; quantidade = linhas, receita = VALOR TERMO SMP).
  - **Aparelhos:** QTD APARELHOS e VALOR APARELHO, em qualquer classe, exceto NÃO CONTABILIZA.
  - **NÃO CONTABILIZA** nunca conta. **NEO repetido** soma todas as linhas.
  - **Sem valor:** linha com quantidade e sem valor conta a quantidade e vai para "pendências".
  - **Equipe:** vem **do sistema**, nunca da planilha. A coluna EQUIPE só sugere a equipe de quem é novo.
- **Modelo `pedidos_fibra`** (aba "Básica" da mesma planilha; cada aba é uma fonte, escolhida pelo `gid` do link):
  - **Colunas:** CONSULTOR, NEO, Quant., VALOR TOTAL, TIPO PRODUTO, EQUIPE CANAL DIRETO, GRUPO CLASSE, GRUPO STATUS, MÊS CONCLUSÃO.
  - **O que conta:** `GRUPO STATUS = EXECUTADO` e `TIPO PRODUTO` = BANDA LARGA, TV ou VOZ.
  - **Alta Fibra** = ALTA ou qualquer classe que comece com MIGRAÇÃO; **Reno Fibra** = qualquer classe que comece com RENOVAÇÃO. Quantidade = Quant., receita = VALOR TOTAL.
- **Modelo `pedidos_vada`** (aba "VADA"): colunas CONSULTOR, QTD, VALOR TOTAL, EQUIPE CANAL INTERNO, CLASSE, STATUS 1, MÊS/ANO F1.
  - **O que conta:** `STATUS 1 = APROVADO - ENVIADO P/ INSTALAÇÃO`, no mês de MÊS/ANO F1, qualquer CLASSE menos NÃO CONTABILIZA. Vai tudo para **Alta VADA** (quantidade = QTD, receita = VALOR TOTAL). STATUS 2 (ex.: CANCELADO) não é olhado.
- **Regras com prefixo:** `regras[].prefixos` pega qualquer classe que comece com o texto. A prévia lista as classes executadas encontradas e para onde cada uma foi ("não conta" em vermelho), para pegar classes novas.
- **Mês:** aceita `outubro_2026`, `out/2026`, `10/2026`, `01/10/2026` e `2026-10`.
- **Próximos passos combinados:** outras planilhas por produto (energia etc., com novos modelos em `MODELOS`) e, depois de validado, leitura automática (cron da Vercel) só para o mês aberto.

### Headcount (`/headcount`)
- **O que mostra:** fotografia do mês: começou com, admissões, desligamentos, fecha com, % perdido, e a meta geral com quem está dentro da meta (quantidade e %).
- **Detalhe:** tabela por canal e equipe e lista de quem entrou e saiu.
- **Filtro de supervisores:** várias escolhas; mostra o nome do líder quando houver.

### Equipes e colaboradores (`/estrutura`)
- **Página inicial:** cartões de equipes por canal, busca de pessoa, "+ Cadastrar pessoa" e "+ Nova equipe" (cada um em tela própria).
- **Página da equipe:**
  - pessoas (ativos e desligados) com **Editar** (nome, admissão, cota), **Trocar de equipe** (nova equipe + mês de início; o passado fica na equipe antiga; trocas futuras podem ser desfeitas) e **Desligar** (com data);
  - troca em lote e ⚙ Configurar a equipe.

### Organograma (`/organograma`)
- **Por liderança** (cargos em `/organograma/editar`: nome, cargo, a quem responde, equipes que lidera) e **Por canal**.
- **Visual:** zoom, abas por gerente, fotos, etiqueta "novo" para menos de 3 meses de casa.

### Campanhas (`/campanhas`)
- **Cadastro:** regras próprias; itens com alvo (texto livre); participantes colaboradores ou equipes; alvo individual ou coletivo; resultados lançados à mão.
- **Visuais:** Corrida, Foguete, Pódio e Termômetro, com confete.
- **Personalização:** capa, foto do prêmio, cor, personagens, frase e fotos dos participantes, guardadas no bucket `midia` (upload pelo servidor com a chave secreta).
- **Modo TV:** atualiza a cada minuto.

### Controle Indireto (`/indireto`)
- **Parceiros:** CPF ou CNPJ validado, status, data de ativação, ponto focal, contatos.
- **Treinamentos e apontamentos:** treinamentos de onboarding, telecom e serviços; apontamentos sem edição posterior; histórico de alterações por gatilho.
- **Validação pelo gerente:** volta para pendente se o ponto focal editar. **Validação automática** quando o parceiro responde o Formulário Google (`integracoes-google-forms.gs`, um script por formulário com `TIPO_TREINAMENTO`; webhook `/api/forms`; o parceiro é achado pelo CPF/CNPJ das respostas). O gerente pode desvalidar.
- **Status:** lista em `parceiro_status` (Aguardando interação, Em contato, Declinou, Ativo, Contato desatualizado, Base). O gerente (`validar`) ou admin cria, renomeia, ordena, escolhe a cor, desativa (some da escolha) e marca "esconder da lista" (Declinou). Status antigos migrados: prospecção → aguardando interação, onboarding → em contato, inativo → declinou.
- **Venda vinculada:** ao gravar uma fonte de dados, a primeira venda de cada parceiro (nome do CONSULTOR = nome fantasia ou razão social, sem acento/maiúsculas) fica gravada em `venda_mes/produto/qtd/valor` e **não muda mais**. "Desfazer" a gravação solta as vendas que ela vinculou.
- **Ativação boa:** venda até 30 dias da data de ativação. Como as planilhas só têm o mês, vale a venda até o mês em que o prazo termina. Estados: ativação boa, no prazo, vendeu fora do prazo, sem venda em 30 dias.
- **Data de ativação travada** (no banco, `parceiro_trava_ativacao`): depois da primeira validação aprovada (`ativacao_travada_em`, fica mesmo se voltar para pendente) ou depois de 30 dias da ativação, só gerente/admin altera.
- **Filtros:** mês de ativação, venda em 30 dias, formulário respondido, validação e treinamento pendente.

### Preparador de material (`/preparador`, só admin)
- **Processamento:** a base de clientes (ex.: 50 mil linhas) é lida **no navegador**; nada vai para o servidor.
- **Filtros prontos:** Situação (padrão ATIVA), produtos, M Móvel e M Fixa (entre/tem/não tem), apto a renovação, pedidos, linhas, consultor, porte, fibra, velocidade, débito, BL B2C, disponibilidade, VVN e crédito de aparelho, mais qualquer outra coluna.
- **Filtros salvos:** ficam no `localStorage` do navegador.
- **Saída:** CNPJ formatado, endereço numa célula, telefones formatados (opção de juntar sem repetidos); separação por aba de um valor de coluna ou em lotes; Excel (com aba "Filtros usados") ou CSV.

### Outros
- **Produtos:** lista com colunas alinhadas; medida (quantidade, receita ou as duas); somas e o que entra nelas.
- **Períodos e fechamentos:** datas de cada ciclo e fator da necessidade bruta.
- **Feriados:** nacionais automáticos; cadastrados por equipe; dia útil extra.
- **Usuários:** criar, permissões de metas e do Indireto, inativar, redefinir senha.

---

## 7. Estrutura de pastas

```
app/
  layout.js, globals.css, icon.png
  login/, setup/
  api/forms/route.js            webhook do Formulário Google
  tv/campanha/[id]/             modo TV
  actions/                      server actions (gravação)
    auth.js usuarios.js dados.js importacao.js fontes.js
    indireto.js campanhas.js midia.js liderancas.js
  (app)/                        telas com login (layout com MenuLateral)
    page.js (Painel) resumo/ metas/ importar/ fontes/ headcount/
    grupos/[id]/ colaboradores/[id]/
    estrutura/ ([id], nova-pessoa, nova-equipe)
    produtos/ periodos/ feriados/ usuarios/ conta/
    organograma/ (editar) campanhas/ ([id]) indireto/ ([id], novo, dados.js) preparador/
components/
  MenuLateral Icones FormAcao CampoNumero SeletorPeriodo AlternarMedida
  BarraRitmo Composicao InfoDica TempoCasa SemPeriodo Pessoas
  Importador ImportadorRelatorio FonteDados Preparador
  PainelCampanha FormCampanha AutoAtualizar ZoomOrganograma FormParceiro
lib/
  dados.js (carregarEstrutura, carregarBase, analisar)  calc.js  datas.js  feriados.js
  formato.js (numero, fmtValor, fmtPct...)  nomes.js (normalizar, similaridade, capitalizar)
  medida.js / medidaServidor.js  auth.js  supabase/server.js, admin.js
  relatorio.js (relatório da operadora)  fontes.js (planilha Google)  conferenciaNomes.js
  headcount.js  campanhas.js  campanhasDados.js  indireto.js  preparador.js
supabase/  001 … 018 (.sql)
public/    logo-duomni.png, logo-duomni-branco.png, simbolo-duomni.png
integracoes-google-forms.gs     script para os Formulários Google
middleware.js                   exige login (exceto /login, /setup, /api/forms)
```

### Padrões de código

- **Gravação:** server actions em `app/actions`; formulários usam `<FormAcao acao={...}>` e as ações devolvem `{ ok }` ou `{ erro }`.
- **Edição em grade:** `<CampoNumero acao={acao.bind(null, ...)} />` salva ao sair do campo.
- **Permissões:** checadas na action (`podeEditar`, `ehAdmin`) **e** no banco (RLS).
- **Leitura grande:** paginar de 1000 em 1000 linhas (limite do Supabase).
- **Datas:** como texto `AAAA-MM-DD`, com contas em UTC.
- **Nomes de colunas** de planilhas são comparados com `normalizar` (sem acento ou maiúsculas).
- **Visual:** estilos em `app/globals.css` com variáveis (`--acento`, `--menu` etc.). Não usar `localStorage` para dados do sistema; usar só para conveniências do navegador.

---

## 8. Ideias e pendências conhecidas

- Fonte de dados: modelos para as demais planilhas (energia...) e leitura automática agendada.
- Permissão "Gestor de pessoas": supervisor admite, edita e desliga só nas equipes que lidera (pelo vínculo de cargos).
- Trocas de equipe feitas antes da versão com histórico moveram o passado junto; ajustar manualmente se algum caso importar.
- Filtros salvos do Preparador no banco (hoje ficam no navegador).
- Considerar o plano Pro do Supabase se o sistema virar ferramenta oficial (o plano gratuito pausa após 7 dias sem uso).
