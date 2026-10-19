# Servidor de NEUROPAY (API)

La API de NEUROPAY: inicio de sesión con Google, datos del usuario y sincronización con Gmail. Todo se guarda en MongoDB Atlas. La web sigue en Firebase Hosting.

## Dónde corre

- **En tu PC** (`npm run server`), para desarrollar.
- **En Render** (plan gratis), servicio `neuropay-api`. La configuración está en `render.yaml`.

Las cuentas de Gmail, las sesiones y los datos se guardan cifrados en **MongoDB Atlas** (plan M0, gratis), así que no se pierden cuando Render reinicia el servicio.

## Inicio de sesión

1. Entras con tu cuenta de Google en la web. Google confirma tu correo.
2. El servidor verifica esa confirmación y revisa el correo contra `ALLOWED_EMAILS`: con correos, solo esos entran; si está vacía, entra cualquier cuenta de Google verificada.
3. Si todo está bien, abre una sesión de NEUROPAY (30 días). El navegador guarda solo ese token; en la base de datos solo se guarda su huella.

## Endpoints

Salvo `/health`, `/auth/google` y `/auth/logout`, todos requieren `Authorization: Bearer <token de sesión>`.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Estado del servidor |
| POST | `/auth/google` | Cambia la confirmación de Google por una sesión. Body: `{ idToken }` |
| POST | `/auth/logout` | Cierra la sesión |
| GET | `/me` | Usuario de la sesión |
| GET | `/data` | Movimientos, presupuestos y configuración guardados, con su `version` |
| PUT | `/data` | Guarda los cambios. Body: `{ baseVersion, data }`. Si otro dispositivo guardó antes responde **409** con `{ version, data }` para fusionar |
| GET | `/gmail/accounts` | Cuentas de Gmail conectadas (sin tokens) |
| POST | `/gmail/accounts` | Conecta una cuenta. Body: `{ code, redirectUri }` |
| DELETE | `/gmail/accounts/:id` | Quita una cuenta |
| POST | `/gmail/sync` | Busca avisos en todas las cuentas |

## Sincronización entre dispositivos

Cada documento de datos lleva una `version`. El navegador envía la versión que
conocía (`baseVersion`):

- Si coincide, se guarda y la versión sube en 1.
- Si no coincide, otro dispositivo guardó antes: el servidor responde **409** con
  la versión actual y su contenido. El navegador fusiona en tres vías (base
  compartida, su estado local y la nube) y vuelve a guardar. Nunca se pisa un
  cambio.

La fusión está en `src/lib/cloudSync.ts` y está probada en `test:sync-e2e`, que
simula dos dispositivos contra la base real.

## Configuración

1. Copia `.env.server.example` a `.env` y completa los valores. `.env` no se sube a git.
2. **MongoDB Atlas:**
   - Crea un cluster M0 (gratis) y un usuario con contraseña.
   - En *Network Access*, permite el acceso desde cualquier IP (`0.0.0.0/0`). Render gratis cambia de IP; la base sigue protegida por usuario y contraseña.
   - En *Connect → Drivers*, copia la cadena `mongodb+srv://...` en `MONGODB_URI`.
3. **Google Cloud Console:**
   - Habilita **Gmail API** en el proyecto.
   - En tu cliente OAuth tipo *Aplicación web*, agrega en *Orígenes JavaScript autorizados* `http://localhost:3000` y `https://neuropay-2fc4d.web.app`, y en *URIs de redirección autorizados* los mismos dos.
   - Copia el ID en `GOOGLE_CLIENT_ID` (y en `VITE_GOOGLE_CLIENT_ID` del frontend) y el secreto en `GOOGLE_CLIENT_SECRET`.
4. Ejecuta `npm run server`. En otra terminal, `npm run dev`.

## Render

1. En render.com, crea un **Blueprint** con este repositorio. El plan gratis no pide tarjeta.
2. Render pedirá estos valores: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `MONGODB_URI` y `ALLOWED_EMAILS`. Son los mismos de tu `.env`.
3. El servicio responde en `https://<nombre>.onrender.com/health`.

En el plan gratis, el servidor se duerme tras 15 minutos sin uso. La primera petición después tarda cerca de un minuto.

## Seguridad

- `ALLOWED_EMAILS` limita quién entra y usa Gmail. **Vacío = entra cualquier cuenta de Google verificada**; el filtro lo pone Google con sus *usuarios de prueba*.
- Un correo de Google sin verificar no entra.
- Tokens de Gmail cifrados con AES-256-GCM.
- Sesiones con huella SHA-256; caducan a los 30 días.
- Cada usuario solo accede a sus propios datos.

## Pruebas

```bash
npx tsx server/test-backend.ts   # almacén de cuentas y lectura de correos
npm run test:mongo               # almacén de cuentas contra MongoDB (requiere MONGODB_URI)
npm run test:flow                # flujo completo contra MongoDB (requiere MONGODB_URI)
npm run test:sync-e2e            # dos dispositivos simultáneos contra MongoDB
```

## Pendiente

- El parser de avisos de Yape y BCP todavía no se ha validado con correos reales.
