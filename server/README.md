# Servidor Gmail de NEUROPAY

Lee los avisos de salida de dinero de Yape y BCP en hasta 5 cuentas de Gmail
por usuario. El navegador nunca recibe tokens: solo la lista de cuentas
(correo y fechas) y los avisos ya interpretados.

## Dónde corre

- **En tu PC** (`npm run server`), para desarrollar.
- **En Render** (plan gratis), para la web. La configuración está en `render.yaml`.

Las cuentas se guardan cifradas en **MongoDB Atlas** (plan M0, gratis), así que
no se pierden cuando Render reinicia el servicio.

## Flujo

1. El usuario pulsa "Agregar cuenta" en Perfil → Sincronizar con correo.
2. El navegador abre el popup de Google y obtiene un **código de autorización**.
3. El servidor canjea el código por tokens, guarda el refresh token **cifrado**
   y deja la cuenta asociada al usuario de Firebase.
4. "Buscar avisos" lee los correos de `notificaciones@yape.pe` y
   `notificaciones@notificacionesbcp.com.pe` de los últimos 30 días.
5. Cada aviso de salida de dinero vuelve como sugerencia. Solo se importa lo
   que el usuario confirma.

## Endpoints

Todos requieren `Authorization: Bearer <idToken de Firebase>` salvo `/health`.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Estado del servidor |
| GET | `/gmail/accounts` | Cuentas conectadas (sin tokens) |
| POST | `/gmail/accounts` | Conecta una cuenta. Body: `{ code, redirectUri }` |
| DELETE | `/gmail/accounts/:id` | Quita una cuenta |
| POST | `/gmail/sync` | Busca avisos en todas las cuentas |

## Configuración

1. Copia `.env.server.example` a `.env` y completa los valores. `.env` no se sube a git.
2. **MongoDB Atlas:**
   - Crea un cluster M0 (gratis).
   - En *Database Access*, crea un usuario con contraseña.
   - En *Network Access*, permite el acceso desde cualquier IP (`0.0.0.0/0`).
     Render gratis cambia de IP, por eso hace falta. La base sigue protegida por usuario y contraseña.
   - En *Connect → Drivers*, copia la cadena `mongodb+srv://...` en `MONGODB_URI`
     y reemplaza `<password>` por la contraseña del usuario.
3. **Google Cloud Console:**
   - Habilita **Gmail API**.
   - Crea un cliente OAuth 2.0 de tipo **Aplicación web**.
   - En **Orígenes JavaScript autorizados** agrega `http://localhost:3000` y
     `https://neuropay-2fc4d.web.app`.
   - En **URIs de redirección autorizados** agrega también `http://localhost:3000`.
   - Copia el ID en `VITE_GOOGLE_CLIENT_ID` y el secreto en `GOOGLE_CLIENT_SECRET`, en `.env`.
   - En **Público** (pantalla de consentimiento), pulsa **Publicar aplicación** (En producción).
     En modo Prueba, el permiso de Gmail caduca cada 7 días.
4. Ejecuta `npm run server` (o `npm run server:start`).

## Render

1. En render.com, crea un **Blueprint** con este repositorio. El plan gratis no pide tarjeta.
2. Render pedirá los valores marcados en `render.yaml`: `FIREBASE_API_KEY`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`,
   `MONGODB_URI` y `GMAIL_ALLOWED_EMAILS`. Son los mismos de tu `.env`.
3. El servicio responde en `https://<nombre>.onrender.com/health`.

El plan gratis se duerme tras 15 minutos sin uso; la primera petición tarda
cerca de un minuto. Un plan de pago elimina la espera.

## Seguridad

- Límite de 5 cuentas por usuario, validado en el servidor.
- Solo pueden usar Gmail los correos de `GMAIL_ALLOWED_EMAILS`.
- Refresh tokens cifrados con AES-256-GCM. En la base de datos no hay tokens en claro.
- Si cambias `TOKEN_ENCRYPTION_KEY`, las cuentas conectadas dejan de funcionar y hay que reconectarlas.
- Los correos se leen en memoria: solo se devuelven los campos interpretados.
- Permiso mínimo: `gmail.readonly`.

## Antes de usarlo de verdad

- **Formato de los avisos:** el parser de Yape y BCP todavía no se ha validado
  con correos reales. Conviene probar con un aviso verdadero antes de confiar en
  el beneficiario y el monto.

## Pruebas

```bash
npx tsx server/test-backend.ts                # almacen de cuentas y lectura de correos
npm run test:mongo                            # prueba real contra MongoDB (necesita MONGODB_URI)
npx tsx server/test-dashboard-measures.ts
npx tsx --test src/utils/bankEmailParser.test.ts src/utils/bankEmailParser.senders.test.ts
```
