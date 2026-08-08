# Módulo Entitlements
Deriva el derecho del usuario de la subscription vigente.
`active` solo si `status='active'` y (`current_period_end` nulo o futuro).
Endpoints: `GET /me/entitlement`, `GET /clon/access`.
Todo gating de contenido se valida aquí en el backend (no en el cliente).
