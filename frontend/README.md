# Frontend — ManLab App (PWA)

React + Vite + TypeScript. Instalable. Tema oscuro de marca.

## Marca (ya cableada)
- Tokens: `src/theme/tokens.css` (paleta + tipografías) y `tailwind.config.js`.
- Tipografías OFL incluidas en `public/fonts/` (Bebas Neue, Inter, Cormorant Garamond).
- Íconos PWA en `public/icons/` (generados del emblema). Manifest en `public/manifest.webmanifest`.
- Logos en `public/brand/` (lockup + dragón). Kit completo en `../brand/`.

## Pantallas (Fase 1)
Reto con bitácora · Veredicto · Clon (iframe Delphi, solo si entitlement active) ·
Consejo del día · Auth/onboarding. Fases 2–3: lector EPUB, audiolibros, videoteca, hermandad.

## Reglas
- Todo copy cumple §11 (sin "marco/frame", sin "seducción", T1 solo como cierre). Ver `../docs/SPEC` §11.
- Importa `src/theme/tokens.css` en el entry. `import.meta.env` para la URL del backend.

## Setup
```bash
npm install
npm run dev
```
