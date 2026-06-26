# BInsight Connect — Portal do Cliente

**Repositório:** https://github.com/BINSIGHT-BR/binsight-portal-cliente

> A cópia `portal-cliente/` dentro do [monorepo comercial](https://github.com/BINSIGHT-BR/binsight-portal-comercial) está **deprecated**. Não use `npm run dev:cliente` na raiz do monorepo.

Clientes acompanham pedidos (CNPJ) e a equipe BInsight gerencia o Mapa de Vendas.

## Papéis

| Papel | Quem | Permissões |
|-------|------|------------|
| **admin** | fernando.dantas@binsight.com.br | Todos os pedidos, valores comerciais, acessos |
| **financeiro** | financeiro@binsight.com.br | Mapa operacional, alertas, aprovar clientes |
| **staff** | Outros @binsight.com.br | Ver todos os pedidos (somente leitura) |
| **cliente** | E-mail externo aprovado | Pedidos filtrados por CNPJ + timeline |

## Desenvolvimento local

```bash
git clone https://github.com/BINSIGHT-BR/binsight-portal-cliente.git
cd binsight-portal-cliente
npm install
cp .env.example .env.local
npm run dev    # http://localhost:3001
```

### Variáveis de ambiente (`.env.local`)

```env
VITE_CLIENT_REGISTRY_ID=1zifdxkwq3rYlACtKtcmuXUWtbu6X4Aq0YC-3pBRbva8
VITE_MAPA_SPREADSHEET_ID=1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI
VITE_MAPA_ARCHIVE_IDS=          # CSV de mapas arquivados (multi-ano)
VITE_USE_MOCK_DATA=true         # demo sem API
VITE_SKIP_AUTH=true             # entra direto, sem Google (padrão com mock)
VITE_LOCAL_DEMO_ROLE=admin      # admin | financeiro | cliente
```

Com `VITE_SKIP_AUTH=true`, abre **direto no portal** (sem tela de login). Troque perfil no header: Admin / Financeiro / Cliente.

### Modo produção OAuth (sem Blaze — igual portal comercial)

1. Planilha permanente **BInsight Connect — Registry** com aba `CLIENT_PORTAL_REGISTRY` — ver [`scripts/setup-sheets.md`](./scripts/setup-sheets.md)
2. Compartilhe **Mapa Vendas** e o **Registry** com **Editor** para `financeiro@` e `fernando.dantas@`
3. `.env.local`:
   ```env
   VITE_USE_MOCK_DATA=false
   VITE_SKIP_AUTH=false
   VITE_CLIENT_REGISTRY_ID=1zifdxkwq3rYlACtKtcmuXUWtbu6X4Aq0YC-3pBRbva8
   VITE_MAPA_SPREADSHEET_ID=1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI
   VITE_MAPA_ARCHIVE_IDS=
   ```
4. Login Google — token OAuth grava **direto no CONSOLIDADO** + aba mensal (`Janeiro`…`Dezembro`)
5. Deploy só hosting (Spark): `firebase deploy --only hosting:connect-binsight --project comercial-binsight`

**Financeiro:** criar/editar/excluir pedidos → CONSOLIDADO + espelho na aba do mês (ex. `Junho`).

**Cliente:** lê CONSOLIDADO filtrado por CNPJ (mapa corrente + arquivados). NF e status vêm das colunas J/K/Q/AB — sem abas extras.

**Virada de ano:** novo mapa `MAPA VENDAS YYYY`; ID antigo em `VITE_MAPA_ARCHIVE_IDS`; registry permanece igual.

**Cloud Functions / Blaze:** opcional — código em `functions/` fica como alternativa futura.

## API (Cloud Functions)

Autenticação: `Authorization: Bearer <Firebase ID Token>`

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/me` | Perfil + papéis + status cliente |
| GET | `/api/pedidos` | Pedidos filtrados por papel |
| POST | `/api/pedidos` | Criar pedido (data padrão = hoje) |
| PATCH | `/api/pedidos/:rowNum` | Atualizar linha CONSOLIDADO + histórico |
| DELETE | `/api/pedidos/:rowNum` | Excluir linha |
| GET | `/api/acessos` | Listar registry (financeiro/admin) |
| PATCH | `/api/acessos/:email` | Aprovar/revogar (`status`: ATIVO/REVOGADO) |
| POST | `/api/register` | Nova solicitação PENDENTE + e-mail financeiro (TODO) |

## Planilha CLIENT_PORTAL_REGISTRY

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| email | nome | cnpj | status | approvedBy | approvedAt | additionalCnpjs |

Status: `PENDENTE`, `ATIVO`, `REVOGADO`. Alias legado: aba `CLIENT_ACCESS`.

## Mapa de Vendas (CONSOLIDADO)

- Planilha: `1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI`
- Aba: **CONSOLIDADO** (gid `809888450`)
- Colunas **A–AB** — col **AB** = mensagem visível ao cliente

## Build, lint e deploy

```bash
npm run lint
npm run build
npm run deploy   # hosting:connect-binsight + functions:cliente
```

Adicione o domínio em **Firebase Console → Authentication → Authorized domains**.

## Documentação

- [ARCHITECTURE.md](./ARCHITECTURE.md) — schema, roadmap, insights
- [ROADMAP.md](./ROADMAP.md) — fases do produto
- [BACKEND_SETUP.md](./BACKEND_SETUP.md) — Service Account e deploy das functions
