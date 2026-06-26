# BInsight Connect — Roadmap

Plataforma dual: **cliente** acompanha pedidos + **financeiro/admin** opera o Mapa de Vendas.

## Phase 1 — Fundação ✅

- [x] App Vite + React + TS + Tailwind + Firebase Auth
- [x] Papéis: admin, financeiro, staff, cliente
- [x] Timeline hardware/software (`OrderTimeline`)
- [x] Tipos Mapa A–AB (+ AC observação cliente), col AB = obs cliente
- [x] Alertas: pagamento (L–O) + NF pendente (A + J="Não" após 3 dias)
- [x] Mock mode para demo local
- [x] UI: dashboard, pedidos cliente, admin pedidos, admin acessos
- [x] Documentação: ARCHITECTURE, INSIGHTS, README

## Phase 2 — Integração real (Sheets + API) ✅

- [x] Cloud Functions: leitura/escrita CONSOLIDADO via Service Account
- [x] Planilha `CLIENT_PORTAL_REGISTRY` (aprovação de acessos)
- [x] Cadastro cliente → e-mail para financeiro@ (Gmail API + SMTP fallback)
- [x] CRUD pedidos API: incluir/editar/excluir com data padrão = hoje
- [x] Roteamento para aba mensal do Mapa conforme data col A
- [x] Histórico de alteração de status + timestamp (aba STATUS_HISTORY)
- [x] Reset de senha cliente (Firebase Admin + e-mail)
- [x] Filtros avançados espelhando Mapa (distribuidor, status, vencimento, datas)
- [x] Observação opcional do cliente por pedido (col AC)

## Phase 3 — NF + Drive ✅

- [x] Pasta Drive: `BInsight Connect/Documentos/{CNPJ}/NF/{ano}/`
- [x] Drag-and-drop NF no modal financeiro (PDF/XML)
- [x] Índice NF na aba NF_INDEX
- [x] Download seguro para cliente (via API)
- [ ] Notificação ao cliente quando NF disponível

## Phase 4 — RMA + notificações

- [ ] Aba/sheet RMA vinculada ao pedido
- [ ] Cliente vê status RMA na timeline
- [ ] E-mail/push: pedido faturado, em rota, vencimento próximo
- [ ] URL compartilhável por pedido (interno)

## Phase 5 — Megazord (diferenciais)

- [ ] Chat/observações thread por pedido (cliente ↔ financeiro)
- [ ] SLA visual por etapa
- [ ] Relatório mensal PDF para cliente
- [ ] Multi-CNPJ / holding em um login
- [ ] Integração rastreio transportadora
- [ ] Dashboard NPS pós-entrega
