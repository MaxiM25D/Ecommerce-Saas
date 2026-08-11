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

- Node.js 20.19 o superior.
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

Configurá `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD` y `SUPERADMIN_STORE_SLUG` en `.env` y ejecutá `npm run db:superadmin`. El comando crea o actualiza una cuenta `OWNER`, el rol con permisos máximos disponible actualmente en el panel, y su tienda de prueba. La contraseña local nunca debe subirse a Git.

## Aislamiento multi-tenant

Las entidades comerciales incluyen `tenantId`, las restricciones únicas se componen con ese identificador y las relaciones entre productos, clientes, carritos y pedidos usan claves foráneas compuestas. La aplicación accede a los datos mediante repositorios ligados a un tenant. Las pruebas comprueban tanto el filtrado de consultas como el rechazo de relaciones cruzadas en PostgreSQL.

## Autenticación y onboarding

- `POST /api/auth/register`: crea usuario, tienda, membresía `OWNER` y sesión.
- `POST /api/auth/login`: inicia sesión y permite seleccionar una membresía mediante `tenantSlug`.
- `POST /api/auth/logout`: invalida la sesión actual.
- `GET /api/auth/me`: devuelve el usuario y la tienda activos.
- `POST /api/auth/select-tenant`: cambia de tienda usando un slug y verificando la membresía.
- `GET /api/tenants/resolve/:slug`: resuelve públicamente una tienda activa.
- `GET /api/tenants/context`: devuelve el tenant guardado en la sesión.

La cookie de sesión es `httpOnly`, el token se almacena hasheado en PostgreSQL y el `tenantId` activo nunca se toma del body, query string o parámetros enviados por el frontend.

## Panel administrativo

El panel web está disponible en `http://localhost:3000/admin` y consume rutas protegidas bajo `/api/admin`:

- `GET /dashboard`: métricas y pedidos recientes.
- `GET|POST /categories` y `PATCH|DELETE /categories/:id`: CRUD de categorías.
- `GET|POST /products` y `PATCH|DELETE /products/:id`: CRUD de productos, precio, stock, imágenes y estado.
- `GET|PATCH /store`: identidad, contacto, moneda y configuración visual de la tienda.

Los roles `OWNER` y `ADMIN` pueden modificar datos. `STAFF` tiene acceso de solo lectura. Todas las consultas y mutaciones toman el tenant desde la sesión del servidor.

## Tienda pública

Cada comercio activo tiene un storefront responsive en `/tienda/:slug`, con categorías, buscador, catálogo, detalle en `/tienda/:slug/producto/:productSlug` y carrito persistente por tienda. La API pública bajo `/api/storefront/:slug` expone únicamente productos activos y resuelve internamente el tenant mediante el slug.

## Pedidos y checkout

El checkout público está disponible en `/tienda/:slug/checkout` y crea pedidos con transferencia bancaria. El servidor vuelve a consultar precios y stock, bloquea la tienda durante la operación, descuenta existencias de forma atómica y guarda una copia del nombre, SKU y precio de cada producto. El panel permite aprobar o rechazar pagos, avanzar el pedido por sus estados y cancelar reponiendo el stock una sola vez. El modelo incluye `MERCADO_PAGO` como método futuro, pero todavía no realiza cobros mediante esa plataforma.
