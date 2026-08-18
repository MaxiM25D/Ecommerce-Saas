# Despliegue de InfinityShop

## Arquitectura recomendada para el primer piloto

- **Web:** Vercel, usando `apps/web` como proyecto Next.js del monorepo.
- **API:** Railway, construida con `Dockerfile.api`.
- **PostgreSQL:** Railway PostgreSQL en la misma región que la API.
- **Archivos:** Cloudinary; evita depender del disco efímero del contenedor.
- **Correo:** un proveedor SMTP transaccional con dominio autenticado.
- **DNS:** `app.tudominio.com` para web y `api.tudominio.com` para API.

Usar subdominios del mismo dominio permite conservar `SESSION_COOKIE_SAME_SITE=lax`. Si se prueban primero los dominios gratuitos de Vercel y Railway, usar `SESSION_COOKIE_SAME_SITE=none` y dejar `SESSION_COOKIE_DOMAIN` vacío.

## 1. Antes de publicar

1. Subir `main` a GitHub y comprobar que el workflow **CI** finalice correctamente.
2. Generar una clave de cifrado independiente para producción:

   ```powershell
   [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```

3. No copiar `.env` local. Cargar cada secreto directamente en el panel del proveedor.
4. Usar [deploy/production.env.example](../deploy/production.env.example) como checklist.

## 2. PostgreSQL en Railway

1. Crear un proyecto y agregar PostgreSQL.
2. Elegir una región cercana a los primeros comercios y usar la misma para la API.
3. Referenciar `DATABASE_URL` desde el servicio API; no escribirla en Git.
4. Activar backups diarios y, antes de operar con ventas reales, PITR.

El release de la API ejecuta `npm run db:deploy` como pre-deploy. Si una migración falla, el nuevo despliegue no debe recibir tráfico.

## 3. API en Railway

1. Agregar el repositorio de GitHub como servicio.
2. Railway leerá [railway.json](../railway.json) y construirá [Dockerfile.api](../Dockerfile.api).
3. Configurar las variables de `deploy/production.env.example`.
4. Establecer `APP_VERSION` con el SHA del commit desplegado cuando el proveedor no lo inyecte automáticamente.
5. Configurar un dominio como `api.tudominio.com`.
6. Confirmar:

   - `GET /api/health` responde aunque la base esté temporalmente caída.
   - `GET /api/ready` responde `200` únicamente cuando PostgreSQL está disponible.
   - Los logs aparecen como objetos JSON con `requestId`, duración, estado y contexto de tenant.

Railway usa `/api/ready` para aceptar un despliegue nuevo. También conviene configurar al menos 15 segundos de *draining* para permitir el apagado seguro por `SIGTERM`.

## 4. Web en Vercel

1. Importar el mismo repositorio como un proyecto nuevo.
2. Seleccionar `apps/web` como **Root Directory** y Next.js como framework.
3. Mantener habilitada la inclusión de archivos externos al directorio raíz para que Vercel lea el lockfile del monorepo.
4. Configurar antes del build:

   ```text
   NEXT_PUBLIC_API_URL=https://api.tudominio.com/api
   ```

5. Asignar `app.tudominio.com` y actualizar `WEB_URL` en la API con ese origen exacto.

`NEXT_PUBLIC_API_URL` queda incorporada durante el build. Cambiarla exige un redeploy de la web.

## 5. Mercado Pago

En la aplicación Marketplace de Mercado Pago configurar:

- Callback OAuth: `https://api.tudominio.com/api/integrations/mercadopago/callback`
- Webhook: la URL generada por InfinityShop bajo `/api/payments/mercadopago/webhook/...`
- URLs de retorno: bajo `https://app.tudominio.com`

Completar juntas `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET` y `MP_TOKEN_ENCRYPTION_KEY`. La API rechaza una configuración parcial.

### Facturación de InfinityShop

La suscripción STARTER/PRO se cobra con la cuenta vendedora propia de InfinityShop, no con las cuentas OAuth de los tenants. Configurar:

```text
SAAS_BILLING_PROVIDER=mercado_pago
SAAS_MP_ACCESS_TOKEN=APP_USR-...
SAAS_MP_WEBHOOK_SECRET=...
```

En la aplicación de Mercado Pago de InfinityShop activar los tópicos `subscription_preapproval` y `subscription_authorized_payment`, apuntando a:

```text
https://api.tudominio.com/api/billing/mercadopago/webhook?source_news=webhooks
```

El backend valida la firma, vuelve a consultar el recurso en Mercado Pago y actualiza suscripción, renovaciones, pagos fallidos e historial de facturas. Nunca reutilizar aquí un access token cifrado perteneciente a una tienda.

## 6. Archivos y correo

En producción se recomienda `STORAGE_PROVIDER=cloudinary` y las tres credenciales de Cloudinary. Los comprobantes se suben como recursos autenticados y se entregan mediante enlaces breves.

SMTP es obligatorio en `NODE_ENV=production`, porque verificación, recuperación de contraseña e invitaciones dependen del correo. Autenticar SPF, DKIM y DMARC en el proveedor antes del piloto.

## 7. Backups y restauración

Usar tres capas:

1. Snapshot programado del volumen/base.
2. Recuperación a un punto en el tiempo (PITR).
3. Dump lógico externo con [backup-postgres.ps1](../scripts/backup-postgres.ps1).

Ejemplo local:

```powershell
$env:DATABASE_URL='postgresql://...'
.\scripts\backup-postgres.ps1
```

Un backup no se considera validado hasta restaurarlo en una base temporal y ejecutar `npm run db:test:isolation` contra ella. Nunca practicar una restauración sobre producción.

## 8. Checklist de salida

- CI en verde y repositorio limpio.
- Migraciones aplicadas por pre-deploy.
- `/api/ready` y la tienda pública responden.
- Registro, verificación de email y recuperación probados.
- Pedido de transferencia completo y stock correcto.
- OAuth y webhook de Mercado Pago probados con credenciales de prueba.
- Carga y descarga privada de comprobantes verificadas.
- Backup automático habilitado y restauración ensayada.
- Monitor HTTP externo sobre `/api/ready` y la página principal.
- Procedimiento de rollback conocido por quien opere la plataforma.
