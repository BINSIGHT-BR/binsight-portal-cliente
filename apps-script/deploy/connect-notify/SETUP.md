# Connect Portal Web App — e-mails + autenticação e-mail/senha

Um único Apps Script (`ConnectNotify.gs` + `ConnectAuth.gs`) publicado como Web App executando como **financeiro@binsight.com.br**.

## Abas no Registry (`1zifdxkwq3rYlACtKtcmuXUWtbu6X4Aq0YC-3pBRbva8`)

| Aba | Colunas |
|-----|---------|
| `CLIENT_PORTAL_REGISTRY` | A–H (col H = **NOTIFY E-MAIL**) |
| `CLIENT_PORTAL_AUTH` | EMAIL, PASSWORD_HASH, SALT, UPDATED_AT, UPDATED_BY, MUST_CHANGE |
| `CLIENT_PORTAL_AUTH_LOG` | TIMESTAMP, EMAIL, ACTION, ACTOR, DETAIL |

**Senhas:** hash SHA-256 com salt (nunca texto puro). Reset pelo admin em Acessos → envia senha temporária por e-mail.

## Script properties

| Propriedade | Uso |
|-------------|-----|
| `NOTIFY_SECRET` | Mesmo valor de `VITE_NOTIFY_SECRET` / `VITE_CONNECT_SECRET` no portal |
| `REGISTRY_SPREADSHEET_ID` | (opcional) ID da planilha registry |
| `MAP_SPREADSHEET_ID` | (opcional) Mapa de vendas corrente |
| `MAP_ARCHIVE_IDS` | (opcional) IDs de mapas arquivados, separados por vírgula |

## Publicar (clasp)

```bash
# Sempre a partir da raiz do projeto (NÃO rode de ~):
cd ~/Documents/binsight-portal-cliente

# Reautenticar clasp se invalid_grant (login SEM argumentos extras):
cd apps-script/deploy/connect-notify
npx @google/clasp@latest login
cd ~/Documents/binsight-portal-cliente

npm run deploy:notify
```

O script gera/atualiza `NOTIFY_SECRET` em `.env.production`, publica o código, roda `installNotifySecret` e imprime a URL do Web App.

**Remetente financeiro@:** peça ao `financeiro@binsight.com.br` para abrir o projeto no [script.google.com](https://script.google.com), **Implantar → Gerenciar implantações → Editar** e confirmar **Executar como: Eu (financeiro@)**. Ou transfira a propriedade do projeto para essa conta antes do deploy final.

## 3. Portal produção

Após `npm run deploy:notify`, confira `.env.production`:

```bash
VITE_NOTIFY_WEBAPP_URL=https://script.google.com/macros/s/XXXX/exec
VITE_NOTIFY_SECRET=...
# ou aliases:
# VITE_CONNECT_WEBAPP_URL=...
# VITE_CONNECT_SECRET=...
```

Rebuild + hosting:

```bash
cd ~/Documents/binsight-portal-cliente
npm run deploy:hosting
```

## 4. Manual (sem clasp)

1. [script.google.com](https://script.google.com) → Novo projeto **Connect Notify** (pasta BInsight Portal Comercial).
2. Colar `ConnectNotify.gs` + `ConnectAuth.gs` + `appsscript.json`.
3. **Configurações do projeto → Propriedades do script:** `NOTIFY_SECRET` = mesmo valor de `.env.production`.
4. Executar `installNotifySecret` uma vez (ou definir a propriedade manualmente).
5. **Implantar → App da Web** — Executar como financeiro@, acesso **Qualquer pessoa**.
6. Copiar URL `/exec` para `VITE_NOTIFY_WEBAPP_URL` e rodar `npm run deploy:hosting`.

## Eventos (POST JSON + secret)

| type | Quando |
|------|--------|
| `financeiro_cadastro` | Cliente envia cadastro |
| `cliente_pedido` | Status/obs./pagamento ou NF/boleto (opt-in Sim) |
| `login` | Cliente entra com e-mail + senha |
| `validate_session` | Restaurar sessão |
| `change_password` | Cliente altera senha |
| `admin_reset_password` | Admin define senha temporária |
| `client_pedidos` | Lista pedidos (cliente sem token Google) |
| `client_drive_file` | Download NF/boleto via DriveApp |
| `client_update_notify` | Cliente altera opt-in de e-mail |
