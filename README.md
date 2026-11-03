# NutriLife · Diario de nutrición y digestión

Web app personal (PWA, mobile-first) para el diario que pide la nutricionista: comidas con fotos, bebidas, agua (botella Owala de 750 ml), deposiciones (escala de Bristol), síntomas digestivos, sueño, estrés, notas y seguimiento del ciclo menstrual. Con gráficas, galería, exportación a PDF/CSV y recordatorios.

## Stack

- **Frontend:** React + Vite, sin frameworks de UI. Poppins autoalojada. PWA con service worker propio.
- **Backend:** Node 22 + Express, SQLite integrado (`node:sqlite`, sin dependencias nativas).
- **Fotos:** se guardan en disco (`data/uploads/<usuaria>/`) y **sólo se sirven con sesión iniciada**, comprobando que pertenecen a la usuaria. No hay URLs públicas. Se redimensionan en el móvil antes de subir (y así se eliminan los metadatos EXIF, incluida la ubicación).
- **PDF:** generado en el servidor con PDFKit. **Push:** Web Push con claves VAPID.

## En local

```bash
npm install
npm run seed      # opcional: cuenta demo@nutrilife.app / demo1234 con una semana de ejemplo
npm run dev       # API en :3001 y la app en http://localhost:5173
```

Sin `seed`, la primera vez que abras la app te pedirá crear tu cuenta (sólo se permite **una**).

Producción en local: `npm run build && npm start` → http://localhost:3001

## Privacidad y seguridad

- Login obligatorio (contraseñas con scrypt, cookie de sesión `HttpOnly` + `SameSite=Strict` + `Secure` en producción).
- Registro cerrado tras la primera cuenta. En producción, además, el registro sólo funciona si defines `SETUP_CODE` (o crea la cuenta por terminal con `npm run create-user -- email contraseña Nombre`).
- Límite de intentos de login, comprobación de origen en peticiones que modifican datos, cabeceras CSP/HSTS, `noindex`.
- El service worker nunca guarda en caché datos de `/api` (ni fotos).
- Todo vive en `DATA_DIR` (base de datos + fotos + claves VAPID): **haz copias de seguridad de esa carpeta**.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `PORT` | Puerto (por defecto 3001) |
| `DATA_DIR` | Carpeta de datos (por defecto `./data`) |
| `SETUP_CODE` | Código necesario para crear la cuenta en producción |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Opcional; si no, se generan y guardan en `DATA_DIR` |

## Despliegue (Fly.io, recomendado)

Hace falta HTTPS para instalar la PWA y para las notificaciones, y un disco persistente para la base de datos y las fotos.

```bash
fly launch --no-deploy --copy-config        # usa el Dockerfile y fly.toml incluidos
fly volumes create nutrilife_data --region mad --size 1
fly secrets set SETUP_CODE="algo-largo-y-secreto"
fly deploy
```

Abre `https://<tu-app>.fly.dev` en el móvil, crea la cuenta con el código, y:
- **iPhone (Safari):** Compartir → «Añadir a pantalla de inicio». Las notificaciones sólo funcionan desde la app instalada (iOS 16.4+).
- **Android (Chrome):** menú ⋮ → «Instalar aplicación».

Cualquier servidor con Docker y un volumen sirve igual (Railway, Render con disco, un VPS con Caddy…).
