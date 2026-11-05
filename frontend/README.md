# PriceScope — Frontend

Next.js (App Router) con [shadcn/ui](https://ui.shadcn.com) sobre Base UI y Tailwind CSS.
Todos los comandos se ejecutan desde la carpeta `frontend/`.

Prototipo de referencia de las pantallas:
[PriceScope · Prototipo de pantallas](https://claude.ai/artifact/R5gtqkAMK2T9ckYYJTgUyK).
Es una guía de contenido y estructura; la implementación usa los componentes de shadcn.

## Requisitos

- Node.js 20 o superior
- [pnpm](https://pnpm.io/installation)
- El backend corriendo (ver [`backend/README.md`](../backend/README.md))

## 1. Crear el `.env.local`

```bash
cp .env.example .env.local
```

| Variable | Para qué sirve |
|---|---|
| `BACKEND_URL` | Origen del backend. Por defecto `http://localhost:8000`. |
| `NEXT_PUBLIC_DEMO_EMAIL` | Correo de la cuenta de prueba que se muestra en `/ingresar`. |
| `NEXT_PUBLIC_DEMO_PASSWORD` | Contraseña de esa cuenta. |

Si las dos `NEXT_PUBLIC_DEMO_*` están vacías, el aviso con la cuenta de prueba no aparece.
Tienen que coincidir con el usuario creado con `python -m scripts.seed` en el backend
(`SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`). Son datos ficticios: el proyecto es de estudio.

Next lee estas variables al arrancar: después de cambiarlas, reiniciá `pnpm dev`.

## 2. Configurar el backend para los enlaces de los correos

Los correos de bienvenida y de recuperación llevan un enlace a este frontend. En el `.env`
del **backend**, `FRONTEND_URL` tiene que apuntar a donde corre Next:

```bash
FRONTEND_URL=http://localhost:3000
```

Si no, los enlaces apuntan a otro puerto y no abren las páginas de contraseña.

## 3. Levantar el servidor de desarrollo

```bash
pnpm install
pnpm dev
```

Abrí <http://localhost:3000>.

Si una pantalla sigue mostrando una versión vieja aunque el código cambió, borrá la caché
de Next y volvé a levantarlo:

```bash
rm -rf .next && pnpm dev
```

## Cómo habla con la API

El navegador nunca llama al backend directo: pide a `/api/v1/*` en el mismo origen y
[`next.config.ts`](next.config.ts) lo reescribe a `BACKEND_URL`. Así la cookie de refresco
de la sesión es de primera parte y no hace falta configurar CORS.

- [`src/lib/api.ts`](src/lib/api.ts): cliente tipado (`apiFetch`) y tipos de la API.
- [`src/lib/auth.tsx`](src/lib/auth.tsx): `AuthProvider` y `useAuth` (sesión, login, logout,
  refresco del token) y `HOME_BY_ROLE`, la pantalla de inicio de cada rol.

## Rutas

Las carpetas entre paréntesis, como `(sesion)`, son grupos de rutas: ordenan el código
pero no aparecen en la URL. Todo lo que está dentro de `(sesion)` tiene acceso a la sesión
del usuario por [`(sesion)/layout.tsx`](src/app/(sesion)/layout.tsx), que monta el
`AuthProvider`.

### Públicas

| URL | Archivo | Qué hay |
|---|---|---|
| `/` | [`app/page.tsx`](src/app/page.tsx) | Landing: propuesta de valor y accesos a demo, ingresar y registro. |
| `/demo` | [`app/demo/page.tsx`](src/app/demo/page.tsx) | Formulario para agendar una demo. |
| `/registro` | [`app/registro/page.tsx`](src/app/registro/page.tsx) | Formulario de alta. Todavía no envía datos a la API. |

`/`, `/demo` y `/registro` son anteriores a shadcn y todavía usan sus propios estilos.

### Acceso (login y contraseñas)

| URL | Archivo | Qué hay |
|---|---|---|
| `/ingresar` | [`(sesion)/ingresar/page.tsx`](src/app/(sesion)/ingresar/page.tsx) | Login. |
| `/recuperar` | [`app/recuperar/page.tsx`](src/app/recuperar/page.tsx) | "¿Olvidaste tu contraseña?": pide el correo para mandar el enlace. |
| `/restablecer/[token]` | [`(sesion)/restablecer/[token]/page.tsx`](src/app/(sesion)/restablecer/[token]/page.tsx) | Nueva contraseña, desde el enlace del correo de recuperación. |
| `/definir-contrasena/[token]` | [`(sesion)/definir-contrasena/[token]/page.tsx`](src/app/(sesion)/definir-contrasena/[token]/page.tsx) | Primera contraseña, desde el correo de bienvenida. |

**`/ingresar`** ([`login-form.tsx`](src/components/auth/login-form.tsx))

- Correo y contraseña (con botón para mostrarla). Llama a `POST /auth/login`.
- Si hay cuenta de prueba configurada (ver paso 1), la muestra en un aviso arriba del formulario.
- Muestra un error si las credenciales son incorrectas, y un aviso si se llegó por sesión
  vencida (`?motivo=sesion-vencida`).
- Al ingresar redirige a `?next=` si viene en la URL, o al inicio del rol: `/admin/solicitudes`
  para administradores y `/dashboard` para clientes. Si ya hay sesión, redirige directo.
- Enlaces a `/recuperar` y a `/demo`.

**`/recuperar`** ([`recover-form.tsx`](src/components/auth/recover-form.tsx))

- Pide el correo y llama a `POST /auth/recover`.
- Después muestra "Revisá tu correo" con el correo ingresado. La API responde lo mismo
  exista o no la cuenta, para no revelar qué correos están registrados.
- El enlace del correo lleva a `/restablecer/{token}` y vence en 1 hora.

**`/restablecer/[token]` y `/definir-contrasena/[token]`**
([`set-password-form.tsx`](src/components/auth/set-password-form.tsx))

Las dos usan el mismo formulario con distinto `mode`. Al abrirse llaman a
`POST /auth/token/verify` para saber si el enlace sirve antes de pedir la contraseña.
Piden la contraseña dos veces y muestran en vivo las reglas que exige la API
(8 caracteres, una mayúscula, un número, que coincidan). Guardan con `POST /auth/password`.

| | `/definir-contrasena` (`mode="define"`) | `/restablecer` (`mode="reset"`) |
|---|---|---|
| Cuándo llega | El admin crea el usuario y le llega el correo de bienvenida | El usuario pidió recuperar la contraseña en `/recuperar` |
| Título | "Te damos la bienvenida a PriceScope" | "Restablecé tu contraseña" |
| Muestra | El nombre de la empresa | El correo de la cuenta |
| Al guardar | Inicia sesión y lleva al inicio del rol | "Contraseña actualizada" con botón a `/ingresar` |
| Enlace vencido | Dura 72 horas; hay que pedir otro al equipo de PriceScope | Dura 1 hora; botón para pedir otro en `/recuperar` |

En el primer acceso, si la contraseña se guardó pero el inicio de sesión automático falla,
muestra "Contraseña guardada" con botón a `/ingresar` (el enlace ya no sirve para reintentar).

### Backoffice (solo administradores)

Todo `/admin` pasa por [`admin/layout.tsx`](src/app/(sesion)/admin/layout.tsx), que usa
[`admin-shell.tsx`](src/components/admin/admin-shell.tsx): barra lateral y control de
acceso. Sin sesión manda a `/ingresar?next=…`; con sesión de cliente, al `/dashboard`.
El backend también exige el rol de administrador en cada endpoint.

| URL | Archivo | Qué hay |
|---|---|---|
| `/admin` | [`admin/page.tsx`](src/app/(sesion)/admin/page.tsx) | Redirige a `/admin/solicitudes`. |
| `/admin/solicitudes` | [`admin/solicitudes/page.tsx`](src/app/(sesion)/admin/solicitudes/page.tsx) | Solicitudes de demo recibidas ([`demo-requests-panel.tsx`](src/components/admin/demo-requests-panel.tsx)). |
| `/admin/usuarios` | [`admin/usuarios/page.tsx`](src/app/(sesion)/admin/usuarios/page.tsx) | Listado y búsqueda de usuarios, y alta de usuarios ([`users-panel.tsx`](src/components/admin/users-panel.tsx)). |
| `/admin/usuarios/[id]` | [`admin/usuarios/[id]/page.tsx`](src/app/(sesion)/admin/usuarios/[id]/page.tsx) | Detalle de un usuario: datos, acciones sobre la cuenta y tiendas vinculadas ([`user-detail.tsx`](src/components/admin/user-detail.tsx)). |

"Curaduría" y "Operación" aparecen en la barra lateral pero todavía no tienen página.

### App del cliente

Todas las pantallas del cliente son maquetas con datos de ejemplo: todavía no
llaman a la API ni están protegidas por sesión. Usan [`app-shell.tsx`](src/components/app-shell.tsx)
(sidebar + header con la cotización vigente).

| URL | Archivo | UX | Qué hay |
|---|---|---|---|
| `/dashboard` | [`app/dashboard/page.tsx`](src/app/dashboard/page.tsx) | UX04 | Plantilla de dashboard de shadcn con datos de ejemplo (`data.json`). |
| `/matriz` | [`app/matriz/page.tsx`](src/app/matriz/page.tsx) | UX05 | Matriz de precios por tienda ([`matriz-screen.tsx`](src/components/matriz/matriz-screen.tsx)). |
| `/producto` | [`app/producto/page.tsx`](src/app/producto/page.tsx) | UX06 | Ficha de producto: KPIs, historial de precios y comparación por tienda ([`product-detail-screen.tsx`](src/components/producto/product-detail-screen.tsx)). |
| `/alertas` | [`app/alertas/page.tsx`](src/app/alertas/page.tsx) | UX07 | Lista de alertas del mercado con filtros por tipo y estado ([`alerts-screen.tsx`](src/components/alertas/alerts-screen.tsx)). |
| `/regla-nueva` | [`app/regla-nueva/page.tsx`](src/app/regla-nueva/page.tsx) | UX08 | Formulario para crear una regla de alerta ([`new-rule-screen.tsx`](src/components/regla/new-rule-screen.tsx)). |

## Componentes

- `src/components/ui/`: componentes de shadcn. Se agregan con `pnpm dlx shadcn@latest add <componente>`.
- `src/components/auth/`: pantallas de acceso. [`auth-shell.tsx`](src/components/auth/auth-shell.tsx)
  es el layout de dos columnas de `/ingresar` y `/recuperar` (el panel derecho queda reservado
  para una imagen). [`centered-shell.tsx`](src/components/auth/centered-shell.tsx) es la card
  centrada de las páginas a las que se llega desde un correo.
- `src/components/admin/`: backoffice.
- `src/components/matriz/`: matriz de precios (UX05).
- `src/components/producto/`: ficha de producto (UX06).
- `src/components/alertas/`: alertas del mercado (UX07).
- `src/components/regla/`: creación de reglas de alerta (UX08).
