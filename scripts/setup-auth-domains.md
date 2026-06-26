# Corrigir `auth/unauthorized-domain`

O Firebase bloqueia login quando o **hostname** da página não está na lista de domínios autorizados.

## Passo 1 — Firebase Console (ou CLI)

**Opção A — já aplicado no repo (recomendado):**

O `firebase.json` inclui `auth.authorizedDomains` com `connect-binsight.web.app`. Para publicar:

```bash
cd ~/Documents/binsight-portal-cliente
firebase deploy --only auth --project comercial-binsight
```

> Não inclua porta em `authorizedRedirectUris` do CLI (ex.: evite `http://localhost:3001` — o deploy falha). Localhost entra só em `authorizedDomains` como `localhost`.

**Opção B — Console manual:**

1. Abra: https://console.firebase.google.com/project/comercial-binsight/authentication/settings  
2. Role até **Authorized domains**  
3. Clique **Add domain** e adicione **cada um** (sem `http://` e sem porta):

| Domínio | Uso |
|---------|-----|
| `localhost` | Dev local (`http://localhost:3001`) |
| `connect-binsight.web.app` | Produção |
| `connect-binsight.firebaseapp.com` | Hosting Firebase |

> Se `localhost` **não aparecer** na lista, adicione manualmente. Projetos antigos às vezes perdem essa entrada.

## Passo 2 — Google Cloud OAuth (obrigatório para Google Login)

1. Abra: https://console.cloud.google.com/apis/credentials?project=comercial-binsight  
2. Em **OAuth 2.0 Client IDs**, abra o client **Web client (auto created by Google Service)**  
3. Em **Authorized JavaScript origins**, adicione:
   - `http://localhost:3001`
   - `https://connect-binsight.web.app`
   - `https://connect-binsight.firebaseapp.com`
4. Em **Authorized redirect URIs**, adicione:
   - `http://localhost:3001/__/auth/handler`
   - `https://connect-binsight.web.app/__/auth/handler`
   - `https://comercial-binsight.firebaseapp.com/__/auth/handler`

Aguarde **5–15 minutos** após salvar (propagação Google).

## Passo 3 — Deploy da config Auth

```bash
cd ~/Documents/binsight-portal-cliente
firebase deploy --only auth --project comercial-binsight
```

(Se `invalid_grant` no clasp/Google CLI, use `firebase login --reauth` antes.)

## Passo 4 — Validar

```bash
npm run dev
# Abra SOMENTE: http://localhost:3001
```

## Atalho: modo demo (sem Firebase)

Enquanto ajusta o Firebase, use o modo demo:

```bash
# .env.local
VITE_USE_MOCK_DATA=true
```

Na tela de login, clique **Entrar como Admin / Financeiro / Cliente demo** — não usa Google.

## Produção sem localhost

Teste direto em: https://connect-binsight.web.app  
(após deploy e domínios autorizados)
