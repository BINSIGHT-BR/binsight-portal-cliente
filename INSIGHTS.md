# BInsight Connect — Insights de Produto

Referências e boas práticas extraídas de plataformas de referência para orientar o Portal Cliente.

## Princípios gerais

1. **Transparência progressiva** — O cliente vê só o necessário (status, valor, NF); margens, vendedor e comissão ficam ocultos. Stripe e Shopify seguem o mesmo padrão: dados sensíveis só para operadores internos.
2. **Status em linguagem humana** — Evitar códigos internos (`SOLICITADO`, col Q). A coluna AB (Obs Cliente) é a fonte de verdade para o cliente; o financeiro mantém linguagem clara: "Em rota de entrega", "Pendente de NF", "Licença disponibilizada".
3. **Timeline visual** — Amazon Business e Mercado Livre usam steppers horizontais com ícone no passo atual. Nosso componente `OrderTimeline` replica isso, com fluxo diferenciado hardware (entrega) vs software (licença).
4. **Alertas acionáveis** — Zendesk e Stripe Dashboard destacam itens que exigem ação imediata (vermelho) vs informativos (âmbar). Replicamos: pagamento vencido = crítico; NF pendente +3 dias = operacional.
5. **Onboarding com aprovação** — Shopify B2B e Amazon Business exigem convite ou aprovação antes de ver pedidos. Nosso fluxo `PENDENTE → ATIVO → REVOGADO` espelha isso via aba `CLIENT_ACCESS`.

---

## Por plataforma

### Shopify Order Status
- Página dedicada por pedido com timeline e última atualização.
- **Aplicar:** `OrderCardCliente` expandível com obs AB e data de sync visível.
- **Phase 2:** URL única por pedido (`/pedidos/:ref`) compartilhável internamente.

### Stripe Dashboard
- Filtros persistentes, badges de status coloridos, alertas no topo.
- **Aplicar:** `OrdersList` com busca + filtro por status; `AlertBanner` no dashboard financeiro.
- **Phase 2:** Export CSV filtrado para conciliação.

### Amazon Business / Mercado Livre
- Rastreamento com ícone de caminhão no passo "Em trânsito".
- **Aplicar:** ícone `Truck` no estágio `rota` da timeline.
- **Phase 2:** Integração com código de rastreio do distribuidor.

### Zendesk (visão agente)
- Fila de tickets priorizada por severidade; ações em lote.
- **Aplicar:** alertas ordenados crítico → warning; clique leva ao pedido (Phase 2).
- **Phase 2:** Snooze de alerta, atribuição a responsável.

### Notion / Linear (admin)
- CRUD inline com confirmação antes de gravar em produção.
- **Aplicar:** `OrderEditModal` com campos editáveis por role; mock mode para demo.
- **Phase 2:** Diff antes de salvar na planilha.

---

## UX para clientes B2B

| Momento | O que mostrar | O que ocultar |
|---------|---------------|---------------|
| Pedido novo | "Pedido confirmado" + OC | Distribuidor, margem |
| Aguardando NF | "Pendente de NF" + prazo estimado | Col J, obs interna |
| Faturado | NF + botão download (Phase 3) | Valores de custo |
| Entrega | Timeline até "Entregue" | Transportadora interna |

**Tom de voz:** profissional, objetivo, em português. Evitar jargão de ERP.

---

## UX para financeiro/admin

- **Dashboard primeiro** — Resumo + alertas antes da lista completa (padrão Stripe).
- **Edição contextual** — Modal por pedido, não planilha crua no browser.
- **Auditoria** — Registrar quem aprovou acesso e quem alterou status (Phase 2: coluna log ou Firestore).
- **NF upload** — Drag-drop estilo Google Drive; nomear arquivo `{CNPJ}_{NF}.pdf` (Phase 3).

---

## Segurança e confiança

- Google OAuth apenas; clientes externos nunca veem dados de outro CNPJ.
- Staff `@binsight.com.br` com roles explícitos (admin > financeiro > staff read-only).
- Reset de senha via e-mail Firebase (não expor Admin SDK no client).
- Notificação por e-mail em novo cadastro (Phase 2) — padrão do portal comercial existente.

---

## Métricas sugeridas (Phase 3+)

- Tempo médio entre pedido e primeira atualização AB.
- % pedidos com NF pendente > 3 dias.
- Taxa de aprovação de cadastros (tempo até ATIVO).
- NPS pós-entrega (link opcional no e-mail de status).

---

## Nome da plataforma

**Recomendação: BInsight Connect**

Alternativas consideradas:
- *BInsight Hub Cliente* — genérico demais
- *BInsight Track* — focado em logística, menos adequado para software/licenças

"Connect" comunica vínculo B2B entre cliente e equipe, alinhado ao posicionamento consultivo da BInsight.
