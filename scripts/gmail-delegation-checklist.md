# Gmail — delegação para e-mails do BInsight Connect

**Custo:** envio via Gmail API dentro do Google Workspace → **sem custo extra** (limites normais do Workspace). Cloud Functions já usadas pelo portal → centavos/mês em volume baixo.

## Service account que envia (Cloud Functions Gen2)

```
876892830548-compute@developer.gserviceaccount.com
```

## Passo 1 — Google Cloud (projeto `comercial-binsight`)

1. https://console.cloud.google.com/iam-admin/serviceaccounts?project=comercial-binsight
2. Abrir **876892830548-compute@developer.gserviceaccount.com**
3. Aba **Detalhes** → **Mostrar delegação em todo o domínio** → **Ativar**
4. Copiar o **ID do cliente** (ex. `104561936263771196384`)

## Passo 1b — Chave JSON (obrigatório no Cloud Functions)

1. Na mesma service account → aba **Chaves** → **Adicionar chave** → **Criar nova chave** → **JSON**
2. Salvar o arquivo baixado (não commitar no git)
3. No projeto:
   ```bash
   cd ~/Documents/binsight-portal-cliente
   node scripts/inject-gmail-sa-env.mjs ~/Downloads/arquivo-baixado.json
   firebase deploy --only functions:cliente --project comercial-binsight
   ```

## Passo 1c — Ativar Gmail API (se ainda não)

https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=comercial-binsight → **Ativar**

## Passo 2 — Admin Google Workspace

1. https://admin.google.com
2. **Segurança** → **Acesso e controle de dados** → **Controles de API**
3. **Delegação em todo o domínio** → **Gerenciar delegação em todo o domínio**
4. **Adicionar novo**:
   - ID do cliente: (do passo 1)
   - Escopos:
     ```
     https://www.googleapis.com/auth/gmail.send
     ```
5. **Autorizar**

## Passo 3 — Teste

Subir boleto/NF no portal ou:

```bash
curl -s -X POST "https://connect-binsight.web.app/api/notify/cliente-pedido" \
  -H 'Content-Type: application/json' \
  -d '{"secret":"...","recipients":["seu-email@..."],"pedidoRef":"TEST","nomeCliente":"Teste","subject":"[BInsight] Teste","message":"Teste"}'
```

Resposta esperada: `{"ok":true,"sent":1}` — e-mail de **financeiro@binsight.com.br**.
