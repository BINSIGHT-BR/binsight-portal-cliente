# Setup — BInsight Connect

## Planilha permanente: BInsight Connect — Registry

**ID:** `1zifdxkwq3rYlACtKtcmuXUWtbu6X4Aq0YC-3pBRbva8`

Compartilhe **Editor** com `financeiro@binsight.com.br` e `fernando.dantas@binsight.com.br`.

### Aba `CLIENT_PORTAL_REGISTRY` (A–G)

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| email | nome | cnpj | status | approvedBy | approvedAt | additionalCnpjs |

**Linha 1 (cabeçalho):**

```
email	nome	cnpj	status	approvedBy	approvedAt	additionalCnpjs
```

Valores col D: `PENDENTE` | `ATIVO` | `REVOGADO`

Configure no portal:

```bash
VITE_CLIENT_REGISTRY_ID=1zifdxkwq3rYlACtKtcmuXUWtbu6X4Aq0YC-3pBRbva8
```

Esta planilha **não muda** na virada de ano.

---

## Mapa Vendas (anual)

Pedidos, NF, status e obs cliente vivem nas **colunas** do CONSOLIDADO e das abas mensais (`Janeiro` … `Dezembro`).

| Col | Campo |
|-----|-------|
| E | N° Ped. Cliente (OC) |
| J | NF Emitida? |
| K | N° NF |
| Q | Status pedido |
| AB | Obs. Cliente |

Não é necessário criar abas `PEDIDOS_CLIENTE`, `STATUS_HISTORY` ou `NF_INDEX`.

### Mapa corrente

```bash
VITE_MAPA_SPREADSHEET_ID=1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI  # MAPA VENDAS 2026
```

### Histórico multi-ano (clientes)

```bash
# Vazio enquanto só existe um mapa; em jan/2027 inclua o ID de 2026:
VITE_MAPA_ARCHIVE_IDS=1xLp12EAjknPVJWJPNivvPfe5BQhut6jMeYr8qHJ7foI
```

---

## Ritual de virada de ano (ex.: 2026 → 2027)

1. Duplicar template → `MAPA VENDAS 2027` (abas `Janeiro`…`Dezembro` + `CONSOLIDADO`).
2. Garantir coluna **AB** (`OBS. CLIENTE`) no CONSOLIDADO e nas mensais.
3. Atualizar `VITE_MAPA_SPREADSHEET_ID` → ID do mapa 2027.
4. Mover ID 2026 para `VITE_MAPA_ARCHIVE_IDS`.
5. Redeploy: `firebase deploy --only hosting:connect-binsight`.
6. Registry permanece igual — clientes mantêm acesso.

---

## Permissões

| Quem | Mapa anual | Registry |
|------|------------|----------|
| financeiro@, fernando.dantas@ | Editor | Editor |
| Cliente (após aprovação) | Viewer (arquivo + corrente) | — |

O portal filtra pedidos por CNPJ via OAuth — clientes não veem dados de outros CNPJs.
