# NutriLife · Diario de nutrición y digestión

Web app personal (PWA, mobile-first) para el diario que pide la nutricionista: comidas con fotos, bebidas, agua (botella Owala de 750 ml), deposiciones (escala de Bristol), síntomas digestivos, sueño, estrés, notas y seguimiento del ciclo menstrual. Con historial, gráficas, galería, exportación a PDF/CSV y recordatorios.

Funciona en **Cloudflare Workers** conectado a este repositorio de GitHub: cada push se despliega solo.

## Cómo está hecha

- **App:** React + Vite (carpeta `client/`), servida como archivos estáticos por Cloudflare. Instalable en el móvil.
- **API:** un Worker (`worker/`) con [Hono](https://hono.dev).
- **Datos:** base de datos **D1** (SQLite de Cloudflare). La estructura se crea sola la primera vez.
- **Fotos:** bucket **R2** privado. Las fotos solo se sirven a través del Worker con tu sesión iniciada. No tienen URL pública.
- **PDF y CSV:** se generan en el propio móvil.
- **Recordatorios:** Web Push, enviados por una tarea programada del Worker cada minuto. Las claves se generan solas.

## Publicarla en Cloudflare (una vez)

1. Entra en https://dash.cloudflare.com → **Workers y Pages** → **Crear** → **Importar un repositorio** → conecta GitHub y elige `nutrilife`.
2. Revisa la configuración:
   - Rama: la de este código.
   - Comando de compilación: `npm run build`.
   - Comando de despliegue: `npx wrangler deploy` (es el que viene por defecto).
3. **Desplegar.** Wrangler crea solo la base de datos D1 y el bucket R2.
   - Si da un error sobre R2, entra una vez en **R2** en el panel y actívalo (el plan gratuito sobra), y vuelve a desplegar.
4. Abre la dirección `https://nutrilife.<tu-subdominio>.workers.dev` y **crea tu cuenta enseguida**. Solo se permite una; después el registro queda cerrado.
   - Si quieres más seguridad durante ese primer momento, crea antes un secreto `SETUP_CODE` en *Configuración → Variables y secretos*. La app te lo pedirá al registrarte.
5. En el móvil:
   - **iPhone:** en Safari, *Compartir → Añadir a pantalla de inicio*.
   - **Android:** en Chrome, *⋮ → Instalar aplicación*.

## En local

```bash
npm install
npm run preview          # compila y arranca el Worker en http://localhost:8787 (D1/R2 simulados)
node scripts/seed.js     # en otra terminal: datos de ejemplo, usuario demo@nutrilife.app / demo1234
```

Para desarrollar con recarga en caliente: `npm run dev` (app en http://localhost:5173).

## Privacidad y seguridad

- Login obligatorio: contraseña con PBKDF2-SHA256 y cookie de sesión `HttpOnly`, `Secure` y `SameSite=Strict`.
- Una sola cuenta. Límite de intentos de login y comprobación de origen en las peticiones que modifican datos.
- Cabeceras de seguridad (CSP, HSTS, `noindex`) en `client/public/_headers`.
- El service worker nunca guarda en caché datos de `/api` ni fotos.
- Las fotos se redimensionan en el móvil antes de subirlas, lo que también elimina los metadatos EXIF (incluida la ubicación).
