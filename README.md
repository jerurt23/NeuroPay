# NEUROPAY by Urteagaholding

App personal de control de gastos. Registro por categorías (Comida, Transporte,
Medicina, Ingresos y las que tú crees), presupuestos, gráficos, sincronización
entre dispositivos por cuenta de Google, lectura de avisos bancarios por correo y
comparación con el estado de cuenta en PDF.

Este documento recorre **todo el recorrido**, desde la primera versión hasta el
estado actual, con los pasos que se siguieron y los resultados que se obtuvieron.

---

## 1. Arquitectura actual

```
Tu navegador
├── neuropay-2fc4d.web.app ......... Firebase Hosting (solo archivos estáticos)
└── neuropay-api.onrender.com ...... API en Render (Node/Express)
        ├── Google .................. verifica el inicio de sesión con Google
        └── MongoDB Atlas .......... sesiones, datos y cuentas de Gmail
```

| Pieza | Dónde | Para qué |
|---|---|---|
| Web | Firebase Hosting | Servir los archivos. No ejecuta código de servidor. |
| API | Render (plan gratis) | Inicio de sesión, datos y sincronización con Gmail. |
| Datos | MongoDB Atlas (M0, gratis) | Fuente de verdad de todos los usuarios. |
| Correo | Gmail API | Lee los avisos de Yape y BCP para proponer movimientos. |

El navegador guarda una copia local (`localStorage`) para trabajar sin conexión,
pero MongoDB es la fuente de verdad.

---

## 2. Recorrido completo

### Etapa 1 — App local con Firebase

La primera versión era solo una PWA en el navegador: registro de gastos,
presupuestos, gráficos, perfil. Los datos se guardaban en el navegador
(`localStorage` como fuente principal, IndexedDB como respaldo) y el login era un
formulario de correo y contraseña.

Se intentó subir los datos a Firebase (Auth + Firestore) para tenerlos en varios
dispositivos. **Funcionaba en local, pero al publicar no se podía escalar**: las
Cloud Functions de Firebase exigen el plan Blaze con tarjeta, y Firestore
necesita facturación para el uso previsto. La app seguía funcionando porque el
código tenía respaldo en local, pero la sincronización nunca llegó a producción.

**Resultado:** la app quedó usable en un solo dispositivo, con el riesgo de que
un cambio de navegador o de caché de Firebase rompiera el acceso.

### Etapa 2 — Avisos bancarios por correo

Se construyó el backend de Gmail (`server/gmailClient.ts`,
`server/accountStore.ts`) con una biblioteca propia de la API (`deaf071`,
`dc4bf7a`):

- Hasta 5 cuentas de Gmail por usuario, cada una autorizada por separado.
- Tokens de OAuth **cifrados con AES-256-GCM** antes de guardarse (`server/crypto.ts`).
- Lectura de los remitentes de **Yape** (`notificaciones@yape.pe`) y **BCP**
  (`notificaciones@notificacionesbcp.com.pe`).
- Un `parser` (`src/utils/bankEmailParser.ts`) convierte cada aviso en un
  movimiento propuesto.
- **Nada se importa solo**: cada aviso se muestra como candidato y el usuario lo
  confirma. Nada es automático.

**Resultado:** la función quedó implementada y probada con correos de prueba, pero
el parser todavía no se ha validado con correos reales de Yape y BCP.

### Etapa 3 — MongoDB Atlas y Render

Para salir de los límites de Firebase, se movieron sesiones, datos y cuentas de
Gmail a **MongoDB Atlas** (plan M0, sin tarjeta) y la API a **Render** (plan
gratis, sin tarjeta). El archivo `render.yaml` define el servicio:

```yaml
services:
  - type: web
    name: neuropay-api
    runtime: node
    plan: free
    buildCommand: npm ci
    startCommand: npm run server:start
    healthCheckPath: /health
```

El primer despliegue a Render **falló**. La causa no estaba en el código: el
clon limpio del repositorio, con `npm ci` y el arranque, funcionaba en local
(`449a4d4`). El problema era configuración:

- En Atlas, *Network Access* no incluía `0.0.0.0/0`, así que Render no entraba a
  la base.
- Algunas variables de entorno estaban vacías o mal pegadas en el panel de Render.

**Resultado:** tras corregir el acceso de red en Atlas y las variables, el
servicio quedó **Live** y `https://neuropay-api.onrender.com/health` respondió
`{"ok":true,"service":"neuropay-api"}`.

### Etapa 4 — Login con Google y datos en MongoDB

Se reemplazó el login de Firebase por **Google Identity Services** (`b1119b8`):

1. El navegador pide una confirmación a Google (botón "Continuar con Google").
2. El servidor la verifica con `google-auth-library`, contra las claves públicas
   de Google.
3. El servidor comprueba el correo contra `ALLOWED_EMAILS`. Si esa variable está
   vacía, entra **cualquier cuenta de Google verificada** (el filtro lo pone
   Google con sus *usuarios de prueba*). Si tiene correos, solo esos entran.
4. El servidor emite su propia sesión de 30 días. En el navegador queda solo el
   token; en la base de datos solo su **huella SHA-256**.

Se borró el paquete `firebase` del frontend, `firestore.rules` y
`src/lib/firebase.ts`. Firebase quedó **solo como hosting**.

**Resultado:** los datos dejaron de estar atados a un navegador. Una cuenta de
Google ve lo mismo en cada dispositivo donde se inicie sesión.

### Etapa 5 — Sincronización entre dispositivos

Con los datos en la nube apareció el problema real: dos dispositivos pueden
guardar al mismo tiempo. Si el último que guarda pisa al anterior, se pierden
movimientos. La solución tiene tres piezas (`987713e`):

**a) Versiones en el servidor.** Cada documento de datos lleva un número de
versión. El navegador envía la versión que conocía (`baseVersion`). Si otro
dispositivo ya guardó, el servidor responde **409** con la versión actual y su
contenido, en vez de sobrescribir.

**b) Fusión en tres vías** (`src/lib/cloudSync.ts`). Cuando llega un 409, el
navegador fusiona:

| Origen | Qué es |
|---|---|
| base | Lo último que este dispositivo y la nube compartieron (en `neuropay_sync_<uid>`) |
| local | Lo que tiene este dispositivo ahora |
| remoto | Lo que tiene la nube |

Reglas: los movimientos se identifican por `id`, así que los nuevos de los dos
lados **se suman**. Si un dispositivo borró y el otro editó, gana la edición. Si
no hay base compartida, gana la nube.

**c) Sincronización automática.** Al cambiar algo (con 1.5 s de espera para agrupar),
al volver a la pestaña, al recuperar la conexión y cada 2 minutos. Un 401 cierra la
sesión.

**Resultado:** `test:sync-e2e` simuló dos dispositivos contra Atlas: **7 de 7**.
El primer dispositivo recibió el cambio del segundo, los cambios de los dos se
sumaron, un borrado y una edición simultáneos se respetaron y dos guardados a la
vez no se pisaron.

### Etapa 6 — Publicación y migración

Con la API viva se publicó la web nueva. El sitio **no** cambió de aspecto para
el usuario hasta ese momento, y los datos que ya existían estaban **solo en el
navegador** (Firestore nunca llegó a tener datos: la consola lo confirmó vacío).

Al entrar con Google, `findLegacyLocalData` (`src/lib/localDb.ts`) copió el
conjunto de datos guardado con el identificador de Firebase al identificador de
Google, solo si había **exactamente un** conjunto antiguo.

En la práctica se fusionaron **15 movimientos**: 5 del PC y 10 del teléfono, sin
repetidos. La nube confirmó los 15 y nada se perdió.

### Etapa 7 — Correcciones

**Montos con coma en el celular** (`250767e`). El teclado del móvil escribe la
coma (`12,50`). El campo numérico del navegador descarta cualquier valor con
coma, así que el monto llegaba vacío y el registro se guardaba en **cero**. Se
creó `src/lib/money.ts` (`parseDecimal`), que acepta coma o punto y separadores
de miles, y los campos de monto pasaron a texto con teclado decimal. Además, una
actualización de la nube ya no borra lo que se estaba escribiendo en Registro.

**Reset all** (`250767e`). En el perfil, un botón que borra movimientos,
presupuestos, categorías, ajustes, foto y cuentas de Gmail, en el dispositivo y
en la nube. Escribe `RESET` para confirmar. Pide confirmación justamente porque
no tiene vuelta atrás: un uso real borró los 15 movimientos, y las bases de
comparación quedaron limpias para probar el PDF.

### Etapa 8 — Comparar Est. Cuenta (PDF)

La función más reciente. Sube el estado de cuenta del banco en PDF, lo lee **en
el navegador** (el archivo no sale del dispositivo) y te deja encontrar un
movimiento por condiciones (`b63f37c` y anteriores).

El flujo es:

1. **Subir el PDF.** Si tiene contraseña, la pide y no la guarda.
2. **Indicar condiciones:**
   - **Ingreso** o **Egreso**.
   - **Monto** (opcional).
   - **Referencia** de quién abonó o a quién pagó (opcional). Ignora
     mayúsculas y acentos.
   - **Rango de fechas** (opcional), para afinar.
   - **Excluir Warda** (activado por defecto).
3. **Buscar en el PDF.** Muestra los movimientos que cumplen las condiciones. Los
   que ya están registrados (mismo tipo, día y monto) vienen **sin marcar**.
4. **Subir.** Muestra **¿Deseas subir los gastos?** y solo guarda lo que confirmes.

El archivo protegido se lee con `pdfjs-dist`, que se carga solo al usar el botón
(la app normal pesa lo mismo). El parser (`src/lib/estadoCuenta.ts`) separa
cargos y abonos por la **posición horizontal** del monto en la página, no por
suposiciones del texto.

#### Resultados con tu estado de cuenta

Estado de **septiembre**, cuenta sueldo de BCP: **292 movimientos**, **237
egresos** y **55 ingresos**.

| Control | Del banco | Calculado | |
|---|---|---|---|
| Total cargos | 2,592.58 | 2,592.58 | Igual |
| Total abonos | 2,631.55 | 2,631.55 | Igual |
| Saldo final | 543.04 | 543.04 | Igual |

Saldo anterior 504.07 + abonos 2,631.55 − cargos 2,592.58 = **543.04**. Los tres
cuadran, así que la lectura es completa.

| Warda (Wardadito del BCP) | |
|---|---|
| Egresos a Warda | 63 (S/ 637.00) |
| Ingresos de Warda | 36 (S/ 756.59) |
| Sin Warda, egresos | 237 → **174** |
| Sin Warda, ingresos | 55 → **19** |

Ejemplos de búsqueda:

| Condiciones | Resultado |
|---|---|
| Ingreso 750, referencia "HABERES" | 1 (15/09) |
| Egreso 25.00, referencia "WARDA" | 13 |
| Egreso 25.00, "WARDA", 01/09 al 10/09 | 7 |
| Egreso, 15/09 al 30/09 | 134 |
| Egreso, 15/09 al 30/09, sin Warda | 101 |

Warda son transferencias de ahorro, no gastos ni ingresos, por eso se excluyen por
defecto y se avisa cuántos quedaron fuera.

---

## 3. Resultados

- La app está **publicada** en `https://neuropay-2fc4d.web.app` y la API en
  `https://neuropay-api.onrender.com`.
- Los datos se ven **igual en todos los dispositivos** con la misma cuenta de
  Google, y no se pisan si dos dispositivos guardan a la vez.
- La lectura del PDF cuadra **al céntimo** con los totales del banco.
- Pruebas: `npm run lint` sin errores, **34 pruebas unitarias** en verde,
  `test:flow` 16/16, `test:mongo` 9/9, `test:sync-e2e` 7/7.
- Coste: 0. Hosting, API y base de datos son planes gratuitos.

## 4. Estructura

| Ruta | Contenido |
|------|-----------|
| `src/components` | Vistas: Registro, Dashboard, Perfil, modal del PDF |
| `src/lib` | Sesión, sincronización, local, montos, lector del PDF |
| `src/utils` | Parser de correos bancarios y cálculos |
| `src/data` | Datos iniciales y configuración por defecto |
| `server` | API de NEUROPAY (ver `server/README.md`) |

## 5. Scripts

```bash
npm run dev             # desarrollo en localhost:3000
npm run server          # API en localhost:8787
npm run build           # genera dist/
npm run lint            # comprobación de tipos
npm run test:unit       # fusión, montos y lector del PDF
npm run test:flow       # flujo completo contra MongoDB
npm run test:sync-e2e   # dos dispositivos contra MongoDB
npm run test:mongo      # almacén de cuentas contra MongoDB
```

## 6. Pendiente

- El parser de avisos de Yape y BCP aún no se ha validado con correos reales.
- **Cambiar la contraseña de Atlas y rotar el secreto de Google**: se
  compartieron en el chat de trabajo.
- La categoría de los movimientos del PDF se deduce del comercio; casi todo cae
  en "otro". Falta poder editarla al importar.
- Para que entren más personas: agrégalas como **Usuarios de prueba** en la
  pantalla de consentimiento de Google (hasta 100). Si `ALLOWED_EMAILS` (Render)
  queda vacío, con eso basta: entra cualquier cuenta de Google verificada y cada
  una ve solo sus propios datos.