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
| `install_mapa_trigger` | Instala trigger onEdit no Mapa (automação bloqueada em binsight.com.br — ver abaixo) |

## 5. Trigger Mapa — e-mail quando alguém edita a planilha direto

**O portal Connect já envia e-mail** quando financeiro/admin altera status, obs., pagamento, NF ou boleto **pelo portal** (OAuth → Cloud Function). Esse fluxo **não depende** deste trigger.

**Este trigger só cobre edições manuais** na planilha Mapa (`1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI`): colunas **P** (pagamento), **Q** (status), **AB** (obs. cliente), **AC** (NF), **AD** (boleto), nas abas CONSOLIDADO ou mensais.

### Por que a instalação automática falha (binsight.com.br)

| Caminho | Bloqueio |
|---------|----------|
| `clasp run installMapaNotifyTrigger` | OAuth clasp sem escopo `script.scriptapp` + Execution API |
| Apps Script API `scripts.run` | 403/404 sem `script.scriptapp` no token |
| Web App `POST install_mapa_trigger` | Política de domínio impede acesso **Qualquer pessoa** (401) |
| `clasp login --extra-scopes` | Pode ser interrompido pela política de OAuth da organização |

### Instalação manual (~2 min) — script já vinculado ao Mapa

Foi criado um projeto **Mapa Notify** amarrado à planilha Mapa (Extensões → Apps Script). O código `MapaNotify.gs` já está publicado; falta **executar uma vez** a função que registra o trigger installável.

1. Abra a planilha: [MAPA VENDAS 2026](https://docs.google.com/spreadsheets/d/1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI/edit)
2. Menu **Extensões → Apps Script** (ou abra direto: [editor Mapa Notify](https://script.google.com/home/projects/1pKKA6_1fQD2HgUqUDBkPvYw8KCDnMLhbilxxDRyfUMrDwcZv4KC4ErDx/edit))
3. No seletor de funções (topo), escolha **`installMapaNotifyBound`**
4. Clique **Executar** ▶
5. Na primeira vez: **Revisar permissões** → conta `@binsight.com.br` → **Permitir**
6. Confira o log: deve aparecer `Mapa onEdit trigger installed for bound spreadsheet …`
7. (Opcional) **Triggers** (ícone relógio à esquerda): deve existir um trigger **Ao editar** → função `onEdit` → planilha Mapa

### Alternativa — projeto Connect Notify (standalone)

Se preferir o trigger no projeto central (não vinculado à planilha):

1. Abra: [Connect Notify](https://script.google.com/home/projects/1hgydFnoFk5kBldi1D4ufTwF34nXKuFgsiymFmc2CAnYa5-HGVfEJdE2_/edit)
2. Confirme **Propriedades do script** → `NOTIFY_SECRET` preenchido
3. Execute **`installMapaNotifyTrigger`** uma vez (mesmo fluxo de autorização acima)
4. Triggers → **Ao editar** na planilha `1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI`
