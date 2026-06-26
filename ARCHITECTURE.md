# BInsight Connect — Arquitetura do Portal do Cliente

> Nome sugerido da plataforma: **BInsight Connect** (alternativas: BInsight Hub Cliente, BInsight Track)

App standalone em **`~/Documents/binsight-portal-cliente`** — Vite + React + TypeScript + Firebase Auth + OAuth Sheets (produção sem Blaze).

## Visão geral

```mermaid
flowchart LR
  subgraph clients [Clientes externos]
    C[Google Login]
    C --> P[CONSOLIDADO filtrado por CNPJ]
    P --> T[Timeline via STATUS + AB]
  end
  subgraph binsight [Equipe BInsight]
    F[financeiro@ / fernando.dantas@]
    F --> M[CONSOLIDADO + aba mensal]
    F --> A[Aprovar acessos]
    F --> AL[Alertas pagamento/NF]
  end
  subgraph data [Dados]
    MV[(Mapa Vendas anual)]
    REG[(Registry permanente)]
  end
  P --> MV
  M --> MV
  A --> REG
  AL --> MV
```

Pedidos, NF, status e obs cliente são **colunas** nas abas mensais/CONSOLIDADO — não há abas `PEDIDOS_CLIENTE`, `STATUS_HISTORY` ou `NF_INDEX`.

## Papéis (RBAC)

| Papel | E-mail | Permissões |
|-------|--------|------------|
| **admin** | fernando.dantas@binsight.com.br | Tudo: pedidos, valores comerciais, acessos, reset senha (Phase 2) |
| **financeiro** | financeiro@binsight.com.br | CRUD operacional no Mapa, aprovar clientes, upload NF (Phase 3), alertas |
| **staff** | Outros @binsight.com.br | Leitura de todos os pedidos |
| **cliente** | E-mail externo + status ATIVO | Pedidos do(s) CNPJ(s) vinculados, timeline, obs col AB, download NF (Phase 3) |

Clientes com status **PENDENTE** aguardam aprovação; **REVOGADO** bloqueia acesso.

## Rotas (Phase 1)

| Rota | Público | Descrição |
|------|---------|-----------|
| `/login` | Guest | Google Sign-In |
| `/cadastro` | Cliente novo | Solicitar acesso informando CNPJ |
| `/aguardando` | Cliente pendente | Tela de espera |
| `/` | Autenticado | Dashboard com resumo e alertas (staff) |
| `/pedidos` | Cliente ativo | Lista com `OrderCardCliente` + timeline |
| `/admin/pedidos` | Financeiro/Admin | Mapa completo + `AlertBanner` + CRUD |
| `/admin/acessos` | Financeiro/Admin | Aprovar/revogar `ClientPortalUser` |

## Modelo de dados

### CONSOLIDADO (Mapa Vendas) — colunas A–AB

Planilha: `1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI`, aba **CONSOLIDADO** (gid `809888450`).

| Col | Campo | Visível ao cliente |
|-----|-------|-------------------|
| A | data | Sim |
| B | vendedor | Não |
| C | cnpj | Não (filtro implícito) |
| D | nomeCliente | Não |
| E | numPedidoCli (OC) | Sim |
| F–I | prioridade, produto, dist, ped dist | Parcial |
| J | emissao (NF Emitida?) | Sim |
| K | numNF | Sim |
| L–O | parc1–parc4 | Não |
| P | statusPgto | Parcial |
| Q | status | Sim |
| R–Y | qtd, custos, margens | Não |
| Z | statusComissao | Não |
| AA | obsPedido (interna) | Não |
| **AB** | **obsCliente** | **Sim — mensagem principal ao cliente** |

Tipos TypeScript: `PedidoMapa` (completo), `PedidoCliente` (sanitizado via `sanitizePedidoForClient`).

### CLIENT_PORTAL_REGISTRY

Planilha **permanente** (`VITE_CLIENT_REGISTRY_ID`) — não muda na virada de ano:

**ID padrão:** `1zifdxkwq3rYlACtKtcmuXUWtbu6X4Aq0YC-3pBRbva8`

| Col | Campo | Descrição |
|-----|-------|-----------|
| A | email | E-mail Google do cliente |
| B | nome | Nome / razão social |
| C | cnpj | CNPJ principal |
| D | status | `PENDENTE` \| `ATIVO` \| `REVOGADO` |
| E | approvedBy | Quem aprovou (e-mail BInsight) |
| F | approvedAt | Data da aprovação (dd/mm/aaaa) |
| G | additionalCnpjs | CNPJs extras separados por `;` |

Alias legado: aba `CLIENT_ACCESS` com colunas `aprovado_por` / `data_aprovacao`.

### Timeline de pedidos

Dois fluxos em `src/constants/timeline.ts`:

**Hardware:** Confirmado → Análise de Crédito → Faturado → Em rota → Entregue  

**Software:** Confirmado → Análise de Crédito → Faturado → Licença disponibilizada

Estágio atual derivado de `status`, col J (`emissao`) e col AB (`obsCliente`).

### Status típicos col AB (obsCliente)

`Pendente de NF`, `Pendente de NF e Boleto`, `RMA`, `Pendente de pagamento`, `Cancelado`, `Faturado`, `Em rota de entrega`, `Entregue`, `Licença disponibilizada`, etc.

## Regras de alerta (financeiro/admin)

Implementadas em `src/utils/alerts.ts`:

1. **Pagamento vencido** — col P (`statusPgto`) contém `VENCIDA` (parcelas L–O alimentam essa coluna na planilha).
2. **Pagamento a vencer** — col P = `A VENCER`.
3. **NF pendente** — col A (data) + col J = `Não` e ≥ **3 dias** desde a data do pedido.

Exibidos via `AlertBanner` no dashboard e `/admin/pedidos`.

## Roteamento de abas mensais (novos pedidos)

Ao **inserir** pedido, a data col A (padrão **hoje**) determina a aba mensal de destino:

```ts
// Ex.: 23/06/2026 → aba "Junho " (nome real no Mapa)
resolveMonthlyTabFromDate('23/06/2026')
```

O CONSOLIDADO permanece agregador; novas linhas são espelhadas na aba do mês via OAuth (`monthlySync.ts`).

## Virada de ano

- **Registry:** planilha permanente — não muda.
- **Mapa corrente:** `VITE_MAPA_SPREADSHEET_ID` (ex. MAPA VENDAS 2027).
- **Histórico clientes:** `VITE_MAPA_ARCHIVE_IDS` (CSV de IDs de mapas anteriores).

## Firebase

Reutiliza o projeto `comercial-binsight` (`firebase-applet-config.json` no repo pai).

- **Auth:** Google Sign-In (clientes: qualquer domínio; staff: @binsight.com.br)
- **Hosting:** site `connect-binsight` (`npm run deploy` no projeto standalone)
- **Authorized domains:** incluir URL do portal cliente

Phase 2 usa **Cloud Functions + Service Account** (codebase `cliente`, endpoints `/api/*`).

## API endpoints (Phase 2) — `functions/src/clienteApi.ts`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/me` | Perfil + CNPJs + status |
| GET | `/api/pedidos` | Pedidos filtrados por papel |
| POST | `/api/pedidos` | Criar pedido (data=hoje) |
| PATCH | `/api/pedidos/:rowNum` | Atualizar CONSOLIDADO + histórico |
| DELETE | `/api/pedidos/:rowNum` | Excluir linha |
| GET | `/api/acessos` | Listar CLIENT_PORTAL_REGISTRY |
| PATCH | `/api/acessos/:email` | ATIVO / REVOGADO / PENDENTE |
| POST | `/api/register` | Nova solicitação PENDENTE + e-mail financeiro (TODO) |

Autenticação: `Authorization: Bearer <Firebase ID Token>`.

## Roadmap multi-fase

### Phase 1 ✅ (atual)
- Scaffold Vite app, RBAC, rotas, tipos A–AB, timeline UI, mock data, docs.

### Phase 2 — OAuth Sheets (produção sem Blaze) ✅
- CRUD pedidos direto no CONSOLIDADO + abas mensais.
- Registry permanente + leitura multi-ano para clientes.
- Timeline via colunas STATUS / AB / EMISSÃO.

### Phase 2b — Cloud Functions (opcional, Blaze)
- Proxy Service Account, NF_INDEX, STATUS_HISTORY audit log.

### Phase 3 — NF no Drive
- Upload NF PDF por CNPJ (`drive.file` ou pasta compartilhada SA).
- Botão "Baixar NF" no `OrderCardCliente`.
- Link col K ↔ arquivo Drive.

### Phase 4 — Notificações
- Push/e-mail: mudança col AB, NF disponível, pagamento a vencer.
- Webhooks ou Cloud Scheduler + Gmail API.

## Insights competitivos

Referências analisadas para UX e funcionalidades:

| Plataforma | Insight aplicável |
|------------|-------------------|
| **Shopify Order Status** | Timeline horizontal clara; um número de pedido como âncora visual. |
| **Mercado Livre** | Status em linguagem simples (col AB); atualizações proativas por etapa. |
| **Amazon Business** | Multi-usuário por conta corporativa (CNPJs adicionais na registry). |
| **SAP Ariba** | Separação comprador/aprovador — espelha fluxo cliente vs financeiro BInsight. |
| **FedEx / DHL tracking** | Estágio "Em rota" distinto de "Entregue"; mapa opcional Phase 4. |

## Estrutura de pastas

```
portal-cliente/
├── src/
│   ├── components/     # OrderTimeline, OrderCardCliente, AlertBanner, …
│   ├── constants/      # columns A-AB, timeline, obsCliente
│   ├── contexts/       # AuthContext
│   ├── data/           # mockOrders.ts
│   ├── layouts/        # AppLayout
│   ├── pages/          # Dashboard, Pedidos, Admin…
│   ├── routes/         # ProtectedRoute
│   └── utils/          # orders, alerts, timeline, sanitize
├── ARCHITECTURE.md
└── README.md
```
