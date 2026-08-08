# Módulo Auth
Email + contraseña + magic link. JWT propios (sin SSO de Delphi).
Endpoints: `/auth/register`, `/auth/login`, `/auth/magic-link/request|verify`,
`/auth/password/reset-request|reset`.
Al registrar, resuelve `pending_entitlements` que coincidan por email (caso "pagó con otro correo").
