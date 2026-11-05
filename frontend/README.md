# PriceScope — Frontend

Next.js (App Router) + [shadcn/ui](https://ui.shadcn.com) sobre Base UI y Tailwind CSS.

| | |
|---|---|
| Carpeta de trabajo | Todos los comandos se corren desde `frontend/` |
| Prototipo de pantallas | [PriceScope · Prototipo de pantallas](https://claude.ai/artifact/R5gtqkAMK2T9ckYYJTgUyK) (guía de contenido; la implementación usa shadcn) |
| Backend | [`backend/README.md`](../backend/README.md) |

## Inicio rápido

| Paso | Comando / acción | Nota |
|---|---|---|
| 1. Requisitos | Node.js 20+ y [pnpm](https://pnpm.io/installation) | |
| 2. Variables | `cp .env.example .env.local` | Ver [Variables de entorno](#variables-de-entorno) |
| 3. Dependencias | `pnpm install` | |
| 4. Levantar | `pnpm dev` | Abrí <http://localhost:3000> |

El backend solo hace falta para las pantallas que llaman a la API (ver la columna **¿Sin backend?** en [Rutas](#rutas)).

## Variables de entorno

| Dónde | Variable | Para qué sirve |
|---|---|---|
| `frontend/.env.local` | `BACKEND_URL` | Origen del backend. Por defecto `http://localhost:8000` |
| `frontend/.env.local` | `NEXT_PUBLIC_DEMO_EMAIL` | Correo de la cuenta de prueba que se muestra en `/ingresar` |
| `frontend/.env.local` | `NEXT_PUBLIC_DEMO_PASSWORD` | Contraseña de esa cuenta |
| `backend/.env` | `FRONTEND_URL` | Tiene que ser `http://localhost:3000` para que los enlaces de los correos abran este front |

| Regla | Detalle |
|---|---|
| Cuenta de prueba | Las `NEXT_PUBLIC_DEMO_*` tienen que coincidir con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` del seed del backend (`python -m scripts.seed`). Si están vacías, el aviso no aparece |
| Cambios | Next las lee al arrancar: reiniciá `pnpm dev` después de cambiarlas |
| Datos | Son ficticios: el proyecto es de estudio |

## Rutas

Las carpetas entre paréntesis, como `(sesion)`, son grupos de rutas: ordenan el código pero no aparecen en la URL.
Todo lo que está dentro de `(sesion)` tiene acceso a la sesión mediante [`(sesion)/layout.tsx`](src/app/(sesion)/layout.tsx).

### Públicas

| Ruta | Qué hay | ¿Sin backend? | Archivo |
|---|---|---|---|
| [`/`](http://localhost:3000/) | Landing: propuesta de valor, accesos a demo e ingresar | ✅ | [`app/page.tsx`](src/app/page.tsx) |
| [`/demo`](http://localhost:3000/demo) | Formulario para agendar una demo | ✅ (se ve; enviar necesita API) | [`app/demo/page.tsx`](src/app/demo/page.tsx) |

`/` y `/demo` son anteriores a shadcn y todavía usan sus propios estilos.

### Acceso (login y contraseñas)

| Ruta | Qué hay | ¿Sin backend? | Archivo |
|---|---|---|---|
| [`/ingresar`](http://localhost:3000/ingresar) | Login | ✅ (se ve; ingresar necesita API) | [`(sesion)/ingresar/page.tsx`](src/app/(sesion)/ingresar/page.tsx) |
| [`/recuperar`](http://localhost:3000/recuperar) | "¿Olvidaste tu contraseña?": pide el correo | ✅ (se ve; enviar necesita API) | [`app/recuperar/page.tsx`](src/app/recuperar/page.tsx) |
| `/restablecer/[token]` | Nueva contraseña, desde el correo de recuperación | ❌ verifica el token al abrir | [`(sesion)/restablecer/[token]/page.tsx`](src/app/(sesion)/restablecer/[token]/page.tsx) |
| `/definir-contrasena/[token]` | Primera contraseña, desde el correo de bienvenida | ❌ verifica el token al abrir | [`(sesion)/definir-contrasena/[token]/page.tsx`](src/app/(sesion)/definir-contrasena/[token]/page.tsx) |

### Backoffice (solo administradores)

| Ruta | Qué hay | ¿Sin backend? | Archivo |
|---|---|---|---|
| [`/admin`](http://localhost:3000/admin) | Redirige a `/admin/solicitudes` | — | [`admin/page.tsx`](src/app/(sesion)/admin/page.tsx) |
| [`/admin/solicitudes`](http://localhost:3000/admin/solicitudes) | Solicitudes de demo recibidas | ❌ requiere sesión | [`demo-requests-panel.tsx`](src/components/admin/demo-requests-panel.tsx) |
| [`/admin/usuarios`](http://localhost:3000/admin/usuarios) | Listado, búsqueda y alta de usuarios | ❌ requiere sesión | [`users-panel.tsx`](src/components/admin/users-panel.tsx) |
| `/admin/usuarios/[id]` | Detalle: datos, acciones sobre la cuenta y tiendas vinculadas | ❌ requiere sesión | [`user-detail.tsx`](src/components/admin/user-detail.tsx) |
| — | "Curaduría" y "Operación" (en la barra lateral) | Sin página todavía | [`admin-sidebar.tsx`](src/components/admin/admin-sidebar.tsx) |

| Control de acceso ([`admin-shell.tsx`](src/components/admin/admin-shell.tsx)) | Resultado |
|---|---|
| Sin sesión | Redirige a `/ingresar?next=…` |
| Sesión de cliente | Redirige a `/dashboard` |
| Sesión de admin | Entra. El backend también exige el rol en cada endpoint |

### App del cliente

| Ruta | Qué hay | ¿Sin backend? | Archivo |
|---|---|---|---|
| [`/dashboard`](http://localhost:3000/dashboard) | Plantilla de shadcn con datos de ejemplo (`data.json`). Sin conectar a la API ni protegida por sesión | ✅ | [`app/dashboard/page.tsx`](src/app/dashboard/page.tsx) |

## Pantallas de acceso en detalle

### `/ingresar` · [`login-form.tsx`](src/components/auth/login-form.tsx)

| Caso | Comportamiento |
|---|---|
| Formulario | Correo y contraseña (con botón para mostrarla). Llama a `POST /auth/login` |
| Cuenta de prueba configurada | Aviso con las credenciales arriba del formulario |
| Credenciales incorrectas | Mensaje de error |
| `?motivo=sesion-vencida` | Aviso de sesión vencida |
| Login correcto | Va a `?next=` si viene en la URL; si no, al inicio del rol: `/admin/solicitudes` (admin) o `/dashboard` (cliente) |
| Ya hay sesión | Redirige directo al inicio del rol |
| Enlaces | `/recuperar` y `/demo` |

### `/recuperar` · [`recover-form.tsx`](src/components/auth/recover-form.tsx)

| Caso | Comportamiento |
|---|---|
| Formulario | Pide el correo y llama a `POST /auth/recover` |
| Después de enviar | "Revisá tu correo" con el correo ingresado. La API responde igual exista o no la cuenta |
| Enlace del correo | Lleva a `/restablecer/{token}` y vence en 1 hora |

### `/definir-contrasena` y `/restablecer` · [`set-password-form.tsx`](src/components/auth/set-password-form.tsx)

Las dos usan el mismo formulario con distinto `mode`.

| | `/definir-contrasena` (`mode="define"`) | `/restablecer` (`mode="reset"`) |
|---|---|---|
| Cuándo llega | El admin crea el usuario y le llega el correo de bienvenida | El usuario lo pidió en `/recuperar` |
| Al abrir | `POST /auth/token/verify` | `POST /auth/token/verify` |
| Título | "Te damos la bienvenida a PriceScope" | "Restablecé tu contraseña" |
| Muestra | El nombre de la empresa | El correo de la cuenta |
| Reglas en vivo | 8 caracteres, una mayúscula, un número, que coincidan | Igual |
| Guarda con | `POST /auth/password` | `POST /auth/password` |
| Al guardar | Inicia sesión y lleva al inicio del rol | "Contraseña actualizada" con botón a `/ingresar` |
| Si falla el login automático | "Contraseña guardada" con botón a `/ingresar` | — |
| Vigencia del enlace | 72 horas; hay que pedir otro al equipo | 1 hora; botón para pedir otro en `/recuperar` |

## Cómo habla con la API

El navegador nunca llama al backend directo: pide a `/api/v1/*` en el mismo origen y Next lo reenvía a `BACKEND_URL`.
Así la cookie de sesión es de primera parte y no hace falta CORS.

| Archivo | Qué hace |
|---|---|
| [`next.config.ts`](next.config.ts) | Reescribe `/api/v1/*` → `BACKEND_URL` |
| [`src/lib/api.ts`](src/lib/api.ts) | Cliente tipado (`apiFetch`) y tipos de la API |
| [`src/lib/auth.tsx`](src/lib/auth.tsx) | `AuthProvider` y `useAuth` (sesión, login, logout, refresco del token) y `HOME_BY_ROLE` |

## Componentes

| Carpeta / archivo | Qué hay |
|---|---|
| `src/components/ui/` | Componentes de shadcn. Se agregan con `pnpm dlx shadcn@latest add <componente>` |
| `src/components/auth/` | Pantallas de acceso |
| [`auth-shell.tsx`](src/components/auth/auth-shell.tsx) | Layout de dos columnas de `/ingresar` y `/recuperar` (el panel derecho queda reservado para una imagen) |
| [`centered-shell.tsx`](src/components/auth/centered-shell.tsx) | Card centrada de las páginas a las que se llega desde un correo |
| `src/components/admin/` | Backoffice |
| `src/components/demo/` | Pantalla `/demo` |

## Problemas comunes

| Síntoma | Solución |
|---|---|
| Una pantalla muestra una versión vieja | `rm -rf .next && pnpm dev` |
| No aparece la cuenta de prueba en `/ingresar` | Revisá `NEXT_PUBLIC_DEMO_*` en `.env.local` y reiniciá `pnpm dev` |
| Los enlaces de los correos abren otro puerto | `FRONTEND_URL=http://localhost:3000` en `backend/.env` |
| Consola: ``Route "/admin": Could not validate `instant` `` | Ruido de desarrollo por `cacheComponents` + `redirect()`. La redirección funciona igual |
