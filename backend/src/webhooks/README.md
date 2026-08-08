# Módulo Webhooks (Stripe)
`POST /webhooks/stripe` — VERIFICAR firma `Stripe-Signature` en cada evento. IDEMPOTENTE.
Eventos: checkout.session.completed, customer.subscription.created/updated/deleted,
invoice.paid, invoice.payment_failed.
Mapea email→user; si no existe user, crea `pending_entitlements` (no perder el pago).
`invoice.payment_failed` → past_due + dispara dunning (Brevo). Configurar dunning = requisito (92 fallidos).
