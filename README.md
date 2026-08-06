# LUNEK SaaS

Nueva base multi-tenant para LUNEK. El ecommerce original se conserva sin cambios en `legacy/lunek-app` y se usa solamente como referencia durante la migración.

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
