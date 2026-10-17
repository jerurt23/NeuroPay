# NEUROPAY by Urteagaholding

Control de gastos y compras con estética iOS, red neuronal interactiva,
seguimiento de rutas de transporte punto a punto, sincronización de
alertas bancarias por correo y cifrado E2EE.

Proyecto en construcción.

## Estructura

| Ruta | Contenido |
|------|-----------|
| `src/components` | Vistas y componentes de la interfaz |
| `src/lib` | Sesión, base de datos local y cliente de la API |
| `src/utils` | Parser de correos bancarios y cálculos |
| `src/data` | Datos iniciales y configuración por defecto |
| `server` | Backend de la Gmail API (nunca se publica) |

## Scripts

```bash
npm run dev           # desarrollo en localhost:3000
npm run build         # genera dist/
npm run lint          # comprobacion de tipos
npm run server        # API de NEUROPAY en localhost:8787
```

## Datos

La app guarda los datos en el navegador (localStorage como fuente
principal, IndexedDB como respaldo). Al entrar con Google, además, los
guarda en MongoDB Atlas a través de la API (`server/`), para verlos en
otros dispositivos. La web se publica en Firebase Hosting.