# InfinityShop

Plataforma ecommerce multi-tenant. El ecommerce original de LUNEK se conserva sin cambios en `legacy/lunek-app` y se usa solamente como referencia durante la migración.

## Estructura

- `apps/web`: frontend con Next.js, React, TypeScript y Tailwind CSS.
- `apps/api`: API con Express y TypeScript.
- `packages/database`: esquema multi-tenant de PostgreSQL con Prisma.
- `packages/shared`: tipos y contratos compartidos.
- `packages/config`: configuración común del monorepo.
- `legacy/lunek-app`: ecommerce original, conservado como referencia local y excluido del Git del monorepo.

## Requisitos

- Node.js 22 LTS o superior.
- PostgreSQL (el entorno Docker local usa el puerto `5433` para no interferir con instalaciones existentes).

## Inicio local

1. Ejecutar `npm install` en la raíz.
2. Copiar `.env.example` como `.env` y configurar `DATABASE_URL`.
3. Ejecutar `npm run db:up` para iniciar PostgreSQL con Docker.
4. Ejecutar `npm run db:generate`.
5. Ejecutar `npm run db:migrate -- --name nombre_de_la_migracion`.
6. Ejecutar `npm run db:seed` para cargar las tiendas de demostración.
7. Ejecutar `npm run db:test:isolation` para verificar el aislamiento multi-tenant.
8. En terminales separadas, ejecutar `npm run dev:web` y `npm run dev:api`.

Web: `http://localhost:3000`. API: `http://localhost:4000/api/health`.

## Usuario administrador local

Configurá `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` y `SUPERADMIN_STORE_SLUG` en `.env` y ejecutá `npm run db:superadmin`. El comando crea o actualiza una cuenta `SUPERADMIN` de plataforma, le asigna una tienda de prueba como `OWNER` y activa el plan Pro. La contraseña local nunca debe subirse a Git.

## Aislamiento multi-tenant

Las entidades comerciales incluyen `tenantId`, las restricciones únicas se componen con ese identificador y las relaciones entre productos, clientes, carritos y pedidos usan claves foráneas compuestas. La aplicación accede a los datos mediante repositorios ligados a un tenant. Las pruebas comprueban tanto el filtrado de consultas como el rechazo de relaciones cruzadas en PostgreSQL.

## Autenticación y onboarding

- `POST /api/auth/register`: crea usuario, tienda, membresía `OWNER` y sesión.
- `POST /api/auth/login`: inicia sesión y permite seleccionar una membresía mediante `tenantSlug`.
- `POST /api/auth/logout`: invalida la sesión actual.
- `GET /api/auth/me`: devuelve el usuario y la tienda activos.
- `POST /api/auth/select-tenant`: cambia de tienda usando un slug y verificando la membresía.
- `GET|POST /api/auth/tenants`: lista las tiendas accesibles o crea una nueva con el usuario como `OWNER`.
- `POST /api/auth/email-verification` y `POST /api/auth/verify-email`: generan y consumen enlaces de verificación.
- `POST /api/auth/forgot-password` y `POST /api/auth/reset-password`: recuperan la contraseña y revocan las sesiones anteriores.
- `GET /api/auth/invitations/:token` y `POST /api/auth/invitations/accept`: validan y aceptan invitaciones al equipo.
- `GET /api/tenants/resolve/:slug`: resuelve públicamente una tienda activa.
- `GET /api/tenants/context`: devuelve el tenant guardado en la sesión.

La cookie de sesión es `httpOnly`, el token se almacena hasheado en PostgreSQL y el `tenantId` activo nunca se toma del body, query string o parámetros enviados por el frontend.

El panel incluye un selector multi-tienda. La última selección queda asociada al usuario y se recupera en el próximo login; si esa tienda es suspendida o la membresía desaparece, la sesión cambia automáticamente a otra tienda activa disponible.

Los tokens de verificación, recuperación e invitación también se guardan únicamente como hashes SHA-256, vencen y son de un solo uso. En desarrollo, si SMTP no está configurado, la interfaz muestra un enlace local para probar el flujo. Esos enlaces no se incluyen en respuestas de producción.

## Panel administrativo

El panel web está disponible en `http://localhost:3000/admin` y consume rutas protegidas bajo `/api/admin`:

- `GET /dashboard`: métricas y pedidos recientes.
- `GET|POST /categories` y `PATCH|DELETE /categories/:id`: CRUD de categorías.
- `GET|POST /products` y `PATCH|DELETE /products/:id`: CRUD de productos, precio, stock, imágenes y estado.
- `GET /customers` y `GET /customers/:id`: búsqueda paginada, datos de contacto, estadísticas e historial de compras.
- `GET|PATCH /store`: identidad, contacto, moneda y configuración visual de la tienda.

Los roles `OWNER` y `ADMIN` pueden modificar datos. `STAFF` tiene acceso de solo lectura. El propietario invita colaboradores por email, puede cancelar invitaciones pendientes y el límite del plan contempla tanto miembros como invitaciones activas. Todas las consultas y mutaciones toman el tenant desde la sesión del servidor.

## Tienda pública

Cada comercio activo tiene un storefront responsive en `/tienda/:slug`, con categorías, buscador, catálogo, detalle en `/tienda/:slug/producto/:productSlug` y carrito persistente por tienda. La API pública bajo `/api/storefront/:slug` expone únicamente productos activos y resuelve internamente el tenant mediante el slug.

## Pedidos y checkout

El checkout público está disponible en `/tienda/:slug/checkout` y permite transferencia bancaria o Mercado Pago según la configuración del tenant. El servidor vuelve a consultar precios y stock, reserva existencias de forma atómica y guarda una copia del nombre, SKU y precio de cada producto. Las reservas vencidas se liberan automáticamente.

Las transferencias admiten comprobantes privados PDF o imagen. El panel permite revisarlos, confirmar el pago, preparar el pedido, cargar seguimiento, marcar la entrega y reintentar correos fallidos. El cliente consulta su pedido mediante un token secreto guardado únicamente en su navegador.

## Mercado Pago por tienda

Cada tenant conecta su propia cuenta mediante OAuth Authorization Code con PKCE. Los access y refresh tokens se cifran con AES-256-GCM y nunca se envían al frontend.

1. Crear una aplicación de Marketplace en Mercado Pago.
2. Configurar como callback `http://localhost:4000/api/integrations/mercadopago/callback` en desarrollo.
3. Configurar el webhook de pagos apuntando a la URL pública del backend y copiar su firma secreta.
4. Completar en `.env`: `API_PUBLIC_URL`, `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET` y una `MP_TOKEN_ENCRYPTION_KEY` aleatoria de al menos 32 caracteres.
5. Reiniciar la API e ingresar a **Mi tienda → Mercado Pago → Conectar Mercado Pago**.

Mercado Pago se ofrece solamente cuando la tienda opera en ARS. Para recibir webhooks reales, `API_PUBLIC_URL` debe ser HTTPS y accesible desde Internet; Mercado Pago no acepta `localhost` como URL de notificación o retorno.

## Archivos y correos

En desarrollo, las imágenes se guardan en `storage/public` y los comprobantes en `storage/private`. Para producción se puede configurar Cloudinary con `CLOUDINARY_NAME`, `CLOUDINARY_KEY` y `CLOUDINARY_SECRET`; los comprobantes se almacenan como recursos autenticados.

Los avisos de despacho usan SMTP. Configurá `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM`. Si SMTP no está disponible, el despacho se conserva y el panel permite reintentar la notificación.

## Funciones SaaS

Cada tenant tiene una suscripción `STARTER` o `PRO`. STARTER cuesta $50.000 ARS/mes e incluye 150 productos y un colaborador; PRO cuesta $70.000 ARS/mes e incluye 1.000 productos y cinco colaboradores. Los límites se verifican dentro de transacciones del servidor. Pedidos, checkout, pagos, seguridad y aislamiento no tienen límites por volumen del plan.

El onboarding inicia una prueba STARTER de 14 días. El OWNER consulta uso, elige plan, sincroniza el estado, programa la cancelación y revisa facturas desde **Plan y uso**. La facturación recurrente usa credenciales propias de InfinityShop, completamente separadas del OAuth de Mercado Pago que cada tenant utiliza para cobrar sus pedidos. `SUPERADMIN` conserva `/platform` para soporte operativo.

## Preparación para producción

- `GET /api/health` comprueba el proceso y `GET /api/ready` verifica además PostgreSQL.
- `npm run check` ejecuta tipos, lint, builds, pruebas de API y aislamiento multi-tenant.
- `Dockerfile.api` y `apps/web/Dockerfile` generan imágenes de producción con usuarios sin privilegios.
- `railway.json` despliega migraciones antes de iniciar la API y configura el health check.
- `scripts/backup-postgres.ps1` crea backups verificables con `pg_dump`.

La guía completa, variables y checklist están en [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Ningún secreto real debe guardarse en Git.
