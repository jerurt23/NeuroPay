# Backend Gmail - NeuroPay

Servidor que se encarga de leer correos de Gmail y devolverlos **ya parseados**.
Nunca expone tokens al navegador.

## Por que hace falta un servidor

La app es una SPA. Todo lo que lleva prefijo `VITE_` se compila dentro del
bundle publico (`https://neuropay-2fc4d.web.app/assets/index-XXXX.js`), que
cualquiera puede descargar.

Por eso el **refresh token** de Gmail no puede estar en el frontend: con el se
puede acceder al correo (leer, enviar, cambiar la contrasena).

## Flujo

```
Frontend  --authorization code-->  Backend  --tokens-->  Gmail API
              (vida corta)           (guarda refresh
                                     cifrado en disco)
```

## Archivos

| Archivo | Responsabilidad |
|---------|-----------------|
| `index.ts` | Servidor Express, valida idToken de Firebase, endpoints |
| `gmailClient.ts` | Unico punto que habla con Google por tokens |
| `tokenStore.ts` | Guarda el refresh token cifrado (AES-256-GCM) en disco |

## Configuracion

```bash
cp .env.server.example .env
```

Genera la clave de cifrado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Ejecucion

```bash
npm run server        # con recarga automatica
npm run server:start  # normal
```

Queda en `http://localhost:8787`.

## Endpoints

Todos requieren `Authorization: Bearer <idToken de Firebase>` salvo `/health`.

| Metodo | Ruta | Que hace |
|--------|------|----------|
| GET | `/health` | Estado del servidor |
| GET | `/gmail/session` | Si hay conexion con Gmail |
| DELETE | `/gmail/session` | Desconecta y borra el token |
| POST | `/gmail/sync` | Canjea el code y devuelve correos parseados |
| POST | `/gmail/refresh` | Usa la sesion guardada, sin popup |

## Google Cloud

1. Habilita la **Gmail API** en el proyecto.
2. Crea unas credenciales **OAuth 2.0 Client ID** de tipo *Web application*.
3. En *Authorized JavaScript origins* agrega:
   - `http://localhost:3000`
   - `https://neuropay-2fc4d.web.app`
4. En *Authorized redirect URIs* agrega el `GOOGLE_REDIRECT_URI` del `.env`.

## Seguridad aplicada

- **CORS por lista blanca**: origenes no autorizados reciben 403.
- **Verificacion real de idToken** contra la API de Firebase (firma y revocacion).
- **Refresh token cifrado** con AES-256-GCM en `.data/` (ignorado por git).
- **Los tokens nunca salen** del servidor: la API responde solo con datos parseados.
- **Permiso minimo**: `gmail.readonly` (solo lectura).

## Nota sobre Google Cloud

En el backend, el *API Key* de Google puede restringirse por API y por IP en
Google Cloud Console. No hace falta en el frontend.

## Pruebas

```bash
npx tsx server/test-encryption.ts
```

Verifica que el cifrado del token no filtra el valor en claro y que rechaza
claves incorrectas.

## Nota

El paquete `cors` no se usa: el CORS esta implementado a mano en `index.ts`
para no anadir dependencias (npm tiene un conflicto de peer dependencies con
`esbuild`/`vite` en este proyecto).