# Servidor Gmail de NEUROPAY

Lee los avisos de salida de dinero de Yape y BCP en hasta 5 cuentas de Gmail
por usuario. El navegador nunca recibe tokens: solo la lista de cuentas
(correo y fechas) y los avisos ya interpretados.

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

1. Copia `.env.server.example` a `.env` y completa los valores.
2. En Google Cloud Console:
   - Habilita **Gmail API**.
   - Crea un cliente OAuth 2.0 de tipo **Aplicación web**.
   - En **Orígenes JavaScript autorizados** agrega `http://localhost:3000` y
     `https://neuropay-2fc4d.web.app`.
   - Copia el ID y el secreto a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
3. Ejecuta `npm run server` (o `npm run server:start`).

## Seguridad

- Límite de 5 cuentas por usuario, validado en el servidor.
- Refresh tokens cifrados con AES-256-GCM. En disco no hay tokens en claro.
- Un archivo de cuentas dañado da error y **no se reescribe**, para no perder
  las cuentas de todos.
- Los correos se leen en memoria: solo se devuelven los campos interpretados.
- Permiso mínimo: `gmail.readonly`.

## Antes de usarlo en producción

- **Persistencia:** `GMAIL_DATA_DIR` debe estar en un disco que sobreviva a
  reinicios y despliegues. En planes gratuitos sin disco persistente, las
  cuentas se pierden y hay que reconectarlas.
- **Formato de los avisos:** el parser de Yape y BCP todavía no se ha validado
  con correos reales. Conviene probar con un aviso verdadero antes de confiar
  en el beneficiario y el monto.

## Pruebas

```bash
npx tsx server/test-backend.ts        # almacen de cuentas y lectura de correos
npx tsx server/test-dashboard-measures.ts
npx tsx --test src/utils/bankEmailParser.test.ts src/utils/bankEmailParser.senders.test.ts
```
