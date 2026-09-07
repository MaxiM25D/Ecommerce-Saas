# Checklist de producción de InfinityShop

No pegues secretos en el repositorio. Cargalos en Railway y mantené los archivos `.env` solamente para desarrollo local.

## 1. Servicios y dominios

- Web publicada con `NEXT_PUBLIC_SITE_URL=https://infinityshop.com.ar`.
- Web conectada a la API con `NEXT_PUBLIC_API_URL` y `API_INTERNAL_URL`.
- `PLATFORM_HOSTS=infinityshop.com.ar,www.infinityshop.com.ar`.
- API publicada con `API_PUBLIC_URL`, `WEB_URL` y `TRUST_PROXY_HOPS=1`.
- Cloudflare en modo Full (strict), DNS correcto y redirección de `www` definida.

## 2. Datos y archivos

- Ejecutar `npm run db:deploy` antes de habilitar tráfico.
- Usar PostgreSQL con backups automáticos.
- Usar `STORAGE_PROVIDER=cloudinary`; el disco local de Railway no debe guardar comprobantes o imágenes definitivas.
- Confirmar que los comprobantes privados no tengan una URL pública permanente.

## 3. Comunicaciones y cobros

- Resend configurado con `EMAIL_PROVIDER=resend`, `EMAIL_FROM` y `RESEND_API_KEY`.
- Probar registro, recuperación, invitación, pedido y cambio de estado.
- OAuth de Mercado Pago por tienda probado con un comprador distinto al vendedor.
- Facturación SaaS probada con credenciales de producción y webhook firmado.
- Nunca reutilizar el token SaaS para cobrar ventas de las tiendas.

## 4. Verificación técnica

- `GET /api/health` responde `ok` y `GET /api/ready` confirma la base de datos.
- `npm run check` termina sin errores.
- `npm audit --omit=dev` informa cero vulnerabilidades conocidas.
- Probar Starter y Pro con cuentas independientes; Starter no debe acceder a endpoints PRO.
- Probar checkout con pago exitoso, rechazado y correo temporalmente fallido.
- Verificar en móvil: home, login, onboarding, catálogo, producto, carrito, checkout y panel.

## 5. Operación inicial

- Activar alertas de errores y disponibilidad para web, API y base de datos.
- Revisar logs de API, cola de emails y webhooks diariamente durante los primeros clientes.
- Definir responsable y procedimiento para restaurar un backup.
- Ejecutar una auditoría de Core Web Vitals sobre la URL pública después del despliegue.
