# Backend setup — BInsight Connect

Cloud Functions (`functions/`, codebase `cliente`) no projeto Firebase **`comercial-binsight`**.

## 1. Service Account

1. Firebase Console → Project Settings → Service accounts
2. Copie o e-mail: `comercial-binsight@appspot.gserviceaccount.com` (ou equivalente)
3. Compartilhe **Editor** nas planilhas:
   - Mapa Vendas: `1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI`
   - Registro (`CLIENT_REGISTRY_ID` / `VITE_CLIENT_REGISTRY_ID`) — pode ser a mesma planilha

## 2. Planilha de registro (OAuth — recomendado)

Planilha permanente **BInsight Connect — Registry** (`1zifdxkwq3rYlACtKtcmuXUWtbu6X4Aq0YC-3pBRbva8`):

| Aba | Uso |
|-----|-----|
| `CLIENT_PORTAL_REGISTRY` | Aprovação de acessos (A–G) |

Pedidos/NF/status ficam no **Mapa Vendas** (colunas CONSOLIDADO + abas mensais) — ver [`scripts/setup-sheets.md`](./scripts/setup-sheets.md).

## 2b. Abas extras (só se usar Cloud Functions / Blaze)

| Aba | Uso |
|-----|-----|
| `STATUS_HISTORY` | Histórico audit (legado Functions) |
| `NF_INDEX` | Índice NF Drive (legado Functions) |

## 3. Gmail — notificação de cadastro

**Opção A (recomendada):** Gmail API + domain-wide delegation

1. Google Cloud Console → IAM → Service Accounts → a SA do Firebase
2. Ative **Domain-wide delegation**
3. Google Admin (Workspace) → Segurança → Controles de API → Delegação:
   - Client ID da SA
   - Escopo: `https://www.googleapis.com/auth/gmail.send`
4. Defina `GMAIL_DELEGATED_USER=financeiro@binsight.com.br`

**Opção B:** SMTP fallback (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`)

Cadastro grava na planilha mesmo se o e-mail falhar (erro só no log).

## 4. Drive — upload de NF

A SA cria automaticamente:

`BInsight Connect/Documentos/{CNPJ}/NF/{ano}/`

Compartilhe a pasta raiz com financeiro@ se precisarem acessar arquivos direto no Drive.

Escopos usados: `drive.file`, `drive.readonly`.

## 5. Variáveis de ambiente

```bash
firebase functions:secrets:set CLIENT_REGISTRY_ID --project comercial-binsight
# ou export no deploy / .env functions
```

Ver [`.env.example`](./.env.example) para lista completa.

## 6. Firebase Auth

1. Authentication → Sign-in method → Google (ativado)
2. **Authorized domains** (obrigatório — evita `auth/unauthorized-domain`):
   - Abra: [Authentication → Settings](https://console.firebase.google.com/project/comercial-binsight/authentication/settings)
   - Adicione se ainda não existirem:
     - `localhost` (dev — use **http://localhost:3001**, não `127.0.0.1`)
     - `connect-binsight.web.app`
     - `connect-binsight.firebaseapp.com`
   - Se acessar por IP da rede (`192.168.x.x`), adicione esse host também ou use só `localhost`.
3. Reset de senha: Action URL → `https://connect-binsight.web.app/login`

## 7. Deploy

```bash
cd ~/Documents/binsight-portal-cliente
npm install
npm --prefix functions install
npm run lint
npm --prefix functions run build
npm run build
firebase deploy --only functions:cliente,hosting:connect-binsight --project comercial-binsight
```

Hosting rewrites `/api/**` → `clienteApi` (região `southamerica-east1`).

## 8. Validar API

```bash
# Com token Firebase (staff logado)
curl -H "Authorization: Bearer $TOKEN" https://connect-binsight.web.app/api/me
curl -H "Authorization: Bearer $TOKEN" https://connect-binsight.web.app/api/pedidos
curl -H "Authorization: Bearer $TOKEN" https://connect-binsight.web.app/api/alertas
```

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/me` | Perfil + CNPJs |
| GET | `/api/pedidos` | Lista (+ query: status, distribuidor, statusPgto, search, dateFrom, dateTo) |
| POST | `/api/pedidos` | Criar pedido |
| PATCH | `/api/pedidos/:rowNum` | Editar (cliente: só col AC) |
| DELETE | `/api/pedidos/:rowNum` | Excluir |
| GET | `/api/pedidos/:rowNum/historico` | Histórico status |
| POST | `/api/pedidos/:rowNum/nf` | Upload NF (multipart) |
| GET | `/api/pedidos/:rowNum/nf` | Download NF |
| GET | `/api/alertas` | Alertas financeiro |
| GET/POST/PATCH/DELETE | `/api/acessos` | CRUD acessos |
| POST | `/api/acessos/:email/reset-password` | Reset senha cliente |
| POST | `/api/register` | Cadastro PENDENTE + e-mail |
