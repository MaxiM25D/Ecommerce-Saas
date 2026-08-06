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
- PostgreSQL.

## Inicio local

1. Ejecutar `npm install` en la raíz.
2. Copiar `.env.example` como `.env` y configurar `DATABASE_URL`.
3. Ejecutar `npm run db:generate`.
4. Ejecutar `npm run db:migrate -- --name init` cuando PostgreSQL esté disponible.
5. En terminales separadas, ejecutar `npm run dev:web` y `npm run dev:api`.

Web: `http://localhost:3000`. API: `http://localhost:4000/api/health`.
