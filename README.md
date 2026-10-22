# Duomni · Metas e Controle

Sistema web interno da Duomni para acompanhar **metas comerciais**, **pessoas** e o **Controle Indireto** dos parceiros. Substitui a planilha mensal de metas ("Meta [mês]") e se alimenta sozinho das planilhas de vendas.

Em produção: **https://dominiotelecom.vercel.app** (acesso com login).

> As regras de negócio em detalhe ficam em [`DOCUMENTACAO.md`](./DOCUMENTACAO.md). Este README explica o que o sistema faz, como ele é montado e como trabalhar nele.

---

## Sumário

- [O que o sistema faz](#o-que-o-sistema-faz)
- [Tecnologias](#tecnologias)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como rodar localmente](#como-rodar-localmente)
- [Banco de dados (Supabase)](#banco-de-dados-supabase)
- [Fontes de dados e atualização automática](#fontes-de-dados-e-atualização-automática)
- [Integrações](#integrações)
- [Permissões](#permissões)
- [Como publicar uma alteração](#como-publicar-uma-alteração)
- [Convenções e cuidados](#convenções-e-cuidados)
- [Problemas comuns](#problemas-comuns)

---

## O que o sistema faz

### Metas

| Tela | Para que serve |
|---|---|
| **Resumo da empresa** | Visão geral de todos os canais no mês. |
| **Painel – Executado** | Meta × realizado por canal, equipe e produto, com ritmo por dia útil, quanto falta e o que é preciso por dia e por semana. Tem "Baixar Excel do mês" (quantidade, meta e % por colaborador e produto). |
| **Painel – Projeção** | Quanto o mês deve fechar se o ritmo atual continuar. Considera o executado, o que está em aberto (tramitando do mês e backlog de meses anteriores), a taxa de aprovação da safra e o ritmo de entrada de pedidos. O "i" de cada linha mostra a conta com os números reais. |
| **Quadro de metas** | Lançamento e distribuição das metas por equipe e colaborador. |
| **Tempo falado** | Consolida LeadsBuilder, 3C e folha de ponto (dias trabalhados) por colaborador. |

Os produtos podem ser **simples** ou **soma**: uma soma junta outros produtos, inclusive outras somas. Por exemplo, a Alta Móvel soma a planilha, as totalizações e o B2C. Cada soma mostra "Do que é feito este resultado".

### Pessoas

- **Headcount**: colaboradores ativos por equipe, com admissões e desligamentos.
- **Assiduidade**: chamada do dia e mapa do mês (P = presente, F = falta, A = atestado), com meta de 95%. Quem lança é o líder no organograma ou um administrador. A folha de ponto pode ser importada, e a marcação manual sempre prevalece sobre a importada.

### Controle Indireto

- **Ativação**: cadastro e status dos parceiros. A "ativação boa" é a venda vinculada em até 30 dias da data de ativação.
- **Treinamentos**: Onboarding, Telecom e Serviços, com "feito por" (que pode ser outro ponto focal ou um treinamento em conjunto). Tem placar por ponto focal e formulários respondidos.
- **Acompanhamento**: cadastros, ativações e treinamentos do mês por ponto focal, dia a dia.
- **Formulários**: link individual por parceiro ou link geral com CPF/CNPJ. Quando o parceiro responde, o treinamento fica como realizado.
- **Validação automática**: o cadastro é validado quando todos os treinamentos realizados têm formulário respondido e o parceiro tem venda vinculada.
- **Importações** (só gerente): lista simples de parceiros e a planilha completa de acompanhamento (cadastro, ONBs e treinamentos).

### Materiais

- **Preparador** e **Materiais enviados** (só admin): listas de leads por CNPJ enviadas a cada equipe.
- **Conversão** (todos): a venda conta em até 30 dias do envio, cruzando pelo CNPJ, com qualquer vendedor.

---

## Tecnologias

- **[Next.js 15](https://nextjs.org/)** (App Router, Server Components e Server Actions), em JavaScript.
- **[Supabase](https://supabase.com/)**: Postgres com Row Level Security, autenticação e `pg_cron` para os agendamentos.
- **[Vercel](https://vercel.com/)**: hospedagem e deploy a cada commit na `main`.
- **GitHub Actions**: descompacta os zips de entrega enviados para a raiz do repositório (veja [Como publicar](#como-publicar-uma-alteração)).
- **SheetJS (`xlsx`)**: leitura de planilhas Excel e CSV no navegador.

---

## Estrutura do projeto

```
app/
  (app)/                 Telas com login (menu lateral em layout.js)
    page.js              Painel – Executado
    projecao/            Painel – Projeção
    metas/  resumo/  tempo-falado/  headcount/  assiduidade/
    indireto/            Controle Indireto (ativação, treinamentos, acompanhamento, importações)
    fontes/              Fonte de dados (planilhas Google)
    ...
  actions/               Server Actions ('use server'): gravações e regras com permissão
  api/
    cron/fontes/         Rodada automática das fontes (chamada pelo pg_cron)
    forms/               Recebe respostas dos Formulários Google (Apps Script)
  f/[token]/             Formulário público do parceiro (sem login)
components/              Componentes de tela (os interativos têm 'use client')
lib/                     Regras e funções comuns (servidor e navegador)
  dados.js               Carrega a base do mês e calcula indicadores (metas, somas, ritmo)
  calc.js                Calendário de dias úteis, ciclos e distribuição de metas
  fontes.js              Modelos das planilhas de vendas e regras de contagem
  fontesServidor.js      Leitura e gravação das fontes (com "Desfazer")
  fontesAuto.js          Rodada automática de uma fonte
  projecao.js            Conta do Painel – Projeção
  indireto.js            Regras do Indireto (30 dias, validação, CPF/CNPJ)
  buscarTodas.js         Leitura paginada (contorna o limite de 1.000 linhas)
supabase/                Scripts SQL numerados (001, 002, …), rodados em ordem
public/                  Logo e arquivos estáticos
integracoes-google-forms.gs   Apps Script que envia as respostas dos Formulários Google
DOCUMENTACAO.md          Regras de negócio em detalhe
```

---

## Como rodar localmente

**Pré-requisitos:** Node.js 18.18 ou mais novo e acesso ao projeto no Supabase.

```bash
git clone <url-do-repositorio>
cd <pasta>
npm install
cp .env.example .env.local    # preencha com as chaves do Supabase e os segredos
npm run dev                   # http://localhost:3000
```

Antes de publicar, rode também `npm run build`. Ele pega erros de importação e variáveis indefinidas que o modo de desenvolvimento deixa passar.

### Variáveis de ambiente

A lista completa está em [`.env.example`](./.env.example). Além das chaves do Supabase (URL, chave pública e chave de serviço), o sistema usa:

| Variável | Uso |
|---|---|
| `CRON_SECRET` | Senha da rodada automática. O `pg_cron` chama `/api/cron/fontes` com `Authorization: Bearer <CRON_SECRET>`, e o valor precisa ser o mesmo na Vercel e no SQL de agendamento. |
| `FORMS_WEBHOOK_SECRET` | Senha que o Apps Script dos Formulários Google envia no cabeçalho `x-webhook-secret`. |

Nunca coloque valores reais no repositório. Na Vercel, eles ficam em *Settings → Environment Variables*.

---

## Banco de dados (Supabase)

- **Scripts numerados:** toda mudança de banco é um script em `supabase/`, com número em sequência (`001_…sql`, `002_…sql`, …).
- **Regras dos scripts:** cada script é **aditivo** e **repetível**, ou seja, pode rodar de novo sem estragar nada. Eles são rodados à mão, **em ordem**, no *SQL Editor* do Supabase.
- **Antes de subir o código:** quando uma entrega traz um SQL, ele deve ser rodado **antes** de publicar o código que depende dele.
- **Permissões:** todas as tabelas têm RLS. As permissões ficam em funções do banco, como `eh_admin()`, `pode_editar()`, `usuario_ativo()` e `pode_lancar_assiduidade()`.
- **Gravações do sistema:** a rodada automática e os formulários públicos usam a chave de serviço, sempre no servidor.

> **Importante:** a API do Supabase devolve no máximo **1.000 linhas** por consulta e **não avisa** que cortou. Toda leitura que pode passar disso deve usar `buscarTodas()` (`lib/buscarTodas.js`), com uma ordem estável (por exemplo, a chave primária).

---

## Fontes de dados e atualização automática

As vendas vêm de **planilhas Google** (abas Móvel, Básica/Fibra, VADA e B2C da planilha gerencial). Cada fonte é ligada em **Configurações → Fonte de dados**, com o link da aba e o produto em que cada tipo de venda entra.

- **Leitura pelo cabeçalho:** a planilha é lida pelo nome das colunas, então a ordem das colunas pode mudar.
- **Executado:** só conta o status de executado de cada planilha, no mês de conclusão. O "não contabiliza" nunca conta.
- **Totalização:** as colunas TOTALIZADO e VIVO TOTAL (só "TOTALIZAÇÃO SIM") somam a mais, 1 por pedido (NEO).
- **Nomes:** são ligados aos colaboradores pelo nome, por apelido ou direto na equipe. Nome não reconhecido fica **pendente**, e aparece um aviso no topo do sistema até ser vinculado.
- **Desfazer:** toda gravação pode ser desfeita em "Registro de gravações". O mês fechado não é alterado por nenhuma leitura.
- **Carteira de pedidos:** a mesma leitura grava todos os pedidos por situação (executado, tramitando e pendente/cancelado), com a safra (mês de entrada) e o mês de conclusão. É ela que alimenta o Painel – Projeção.

**Rodada automática:** o `pg_cron` do Supabase chama `/api/cron/fontes?n=0..5` **de hora em hora, das 8h às 19h, de segunda a sexta**, uma fonte por chamada, e atualiza **só o mês atual**. Na tela de Fonte de dados há os botões **Pausar/Ativar** e **Rodar agora**.

---

## Integrações

- **Planilhas Google**: a planilha precisa estar compartilhada como "Qualquer pessoa com o link pode ver". O link precisa terminar com `#gid=…` da aba certa.
- **Formulários Google**: o script `integracoes-google-forms.gs` (Apps Script) envia cada resposta para `/api/forms`. A resposta é ligada ao parceiro pelo CPF/CNPJ ou pelo e-mail.
- **Aponta Fácil** (ponto): integração com a API em estudo. Hoje a folha de ponto é importada por arquivo.

---

## Permissões

| Papel | Pode |
|---|---|
| **Administrador** | Tudo, incluindo usuários, materiais e exclusões. |
| **Editor** | Metas, fontes de dados, importações de resultados e cadastros. |
| **Leitura** | Vê os painéis, sem alterar nada. |
| **Indireto** (por usuário) | Ver, editar ou validar (gerente). Só o gerente valida parceiros, troca ponto focal já definido, edita a lista de status e faz importações. |
| **Líder no organograma** | Lança a assiduidade das suas equipes e das equipes abaixo dele. Para isso, o cargo de liderança precisa estar ligado ao usuário. |

---

## Como publicar uma alteração

As alterações chegam em **zip, só com os arquivos que mudaram**, mantendo as pastas (`app/…`, `lib/…`, `components/…`, `supabase/…`).

1. **Rode o SQL antes, se houver.** No *SQL Editor*, rode o arquivo novo de `supabase/` antes de subir o código.
2. **Suba o zip na raiz do repositório** pelo GitHub (*Add file → Upload files*).
   - **Um zip por vez**, e **nome sem espaço e sem parênteses**. Por exemplo, `painel-projecao-v2.zip`, nunca `painel-projecao (1).zip`.
   - O zip precisa ter **mais de um item na raiz**. Com um item só, a Action desloca as pastas.
3. **A Action descompacta.** A GitHub Action descompacta o zip por cima do projeto, apaga o zip e faz o commit "Descompacta zip".
4. **A Vercel publica** sozinha a partir desse commit. Acompanhe em *Deployments*.

**Se algo der errado:** na Vercel, use *Instant Rollback* no deploy anterior. Depois que a correção subir, abra o deploy novo e clique em **Promote to Production**, porque depois de um rollback a Vercel não promove sozinha.

**Se a Action falhar:** apague os zips que ficaram na raiz e suba de novo um só, com nome sem espaço.

---

## Convenções e cuidados

- **Nunca exporte uma função de um arquivo `'use client'` para usar no servidor.** Isso já derrubou o site. Funções usadas pelos dois lados ficam em `lib/`, sem `'use client'`.
- **Leituras grandes:** use sempre `buscarTodas()` (limite de 1.000 linhas do Supabase).
- **Permissões:** toda gravação passa por uma Server Action em `app/actions/`, que confere a permissão. O banco confere de novo pela RLS.
- **Padrão das telas:**
  - O mês fica no canto superior direito, no formato `‹ Mês Ano ›` com lista (`SeletorPeriodo` nas telas de Metas e `SeletorMes` nas outras).
  - Os filtros seguem o padrão compacto: pílulas de ponto focal, menus com contagem e uma faixa de filtros ativos com ×.
  - As explicações de conta ficam no balão "i" (`InfoBalao`), que abre ao passar o mouse.
- **Textos e nomes:** em português, voltados para quem usa (comercial, supervisão, gerência).
- **Datas:** são calculadas no fuso de São Paulo (`hojeSP()`). Os dias úteis vêm do calendário do sistema (fins de semana, feriados nacionais e feriados cadastrados).

---

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Tela pede "Rode o arquivo 0XX…sql" | O SQL daquela versão não foi rodado, ou o código no ar é mais antigo que o SQL. Confira o último deploy. |
| Marcação "salva" na tela e some ao atualizar | A leitura passou de 1.000 linhas sem `buscarTodas()`. |
| Fonte com "nomes aguardando vínculo" | Vendedor novo ou nome escrito diferente. Abra a fonte, clique em **Ler planilha** e vincule o nome. |
| Rodada automática não aconteceu | Confira se o `CRON_SECRET` da Vercel é o mesmo do SQL de agendamento e se a atualização automática não está pausada. |
| Action "fatal: pathspec … did not match" | Há um zip com espaço no nome, ou mais de um zip na raiz. |

---

Projeto interno da Duomni. Uso restrito aos colaboradores autorizados.
