"use client";

import { BarChart3, Globe, Layers, Mail, ShoppingCart, TicketPercent, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { Role } from "./types";
import { EmptyState, Field, GuideLink, Tip, panelStyles as styles } from "./guided-panel";

const sections = [
  { id: "analytics", label: "Resultados", description: "Entendé tus métricas", icon: BarChart3, help: "Revisá la actividad registrada en tu tienda y los productos más vendidos." },
  { id: "coupons", label: "Cupones", description: "Descuentos para tus clientes", icon: TicketPercent, help: "Creá un código que tus clientes puedan aplicar al comprar. Elegí cuánto descontar y sus condiciones." },
  { id: "variants", label: "Variantes", description: "Talles, colores y opciones", icon: Layers, help: "Agregá opciones a un producto, cada una con su propio código, precio y stock." },
  { id: "shipping", label: "Envíos", description: "Zonas, costos y plazos", icon: Truck, help: "Primero creá una zona de cobertura. Después agregale al menos un método con su costo y plazo." },
  { id: "domains", label: "Dominio", description: "Tu propia dirección web", icon: Globe, help: "Vinculá un dominio que ya sea tuyo. No se compra ni se registra desde este formulario." },
  { id: "notifications", label: "Emails automáticos", description: "Mensajes en cada etapa", icon: Mail, help: "Personalizá el asunto y el mensaje de los correos que acompañan a tus clientes." },
  { id: "carts", label: "Carritos", description: "Recuperá compras pendientes", icon: ShoppingCart, help: "Contactá a quienes dejaron productos en el carrito y todavía no terminaron su compra." },
] as const;

const notificationCopy: Record<string, { title: string; help: string; subject: string; message: string }> = {
  ORDER_CREATED: { title: "Pedido recibido", help: "Se envía cuando se crea un pedido. No significa que el pago esté aprobado.", subject: "Recibimos tu pedido", message: "¡Gracias por elegirnos! Ya recibimos tu compra." },
  ORDER_PAID: { title: "Pago aprobado", help: "Se envía al confirmar el pago de una compra.", subject: "Tu pago fue aprobado", message: "Ya confirmamos tu pago. Vamos a preparar tu pedido." },
  ORDER_SHIPPED: { title: "Pedido enviado", help: "Avisa al cliente cuando su pedido fue despachado.", subject: "Tu pedido está en camino", message: "Despachamos tu compra. Podés consultar el seguimiento de tu pedido." },
  CART_ABANDONED: { title: "Recordatorio de carrito", help: "Es el mensaje usado para recuperar una compra pendiente.", subject: "Tus productos te están esperando", message: "Guardamos tu carrito para que puedas continuar tu compra." },
};

type GrowthData = {
  features: string[];
  products: Array<{ id: string; name: string }>;
  domains: Array<{
    id: string;
    hostname: string;
    status: string;
    verificationToken: string;
    failureReason: string | null;
  }>;
  coupons: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    value: number;
    usedCount: number;
    active: boolean;
  }>;
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    priceInCents: number;
    stock: number;
    product: { name: string };
  }>;
  shippingZones: Array<{
    id: string;
    name: string;
    postalPrefixes: string[];
    methods: Array<{
      id: string;
      name: string;
      priceInCents: number;
      estimatedDays: number | null;
    }>;
  }>;
  notificationRules: Array<{
    event: string;
    active: boolean;
    subject: string;
    message: string;
  }>;
  abandonedCarts: Array<{
    id: string;
    recoveryEmail: string | null;
    updatedAt: string;
    items: Array<{ quantity: number; product: { name: string } }>;
  }>;
  analytics: {
    periodDays: number;
    events: Record<string, number>;
    orders: number;
    revenueInCents: number;
    topProducts: Array<{
      productName: string;
      _sum: { quantity: number | null; subtotalInCents: number | null };
    }>;
  };
};

const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value / 100);

export function GrowthView({ onNavigate, role }: { onNavigate: (tab: "plan" | "products") => void; role: Role }) {
  const [data, setData] = useState<GrowthData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<(typeof sections)[number]["id"]>("analytics");
  const [couponType, setCouponType] = useState("PERCENTAGE");
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const canManage = role !== "STAFF";

  async function load() {
    setData(await apiRequest<GrowthData>("/admin/growth/overview"));
  }
  useEffect(() => {
    apiRequest<GrowthData>("/admin/growth/overview")
      .then(setData)
      .catch((caught) =>
        setError(
          caught instanceof ApiError
            ? caught.message
            : "No se pudo cargar la sección",
        ),
      );
  }, []);
  function handleError(caught: unknown) {
    setError(
      caught instanceof ApiError
        ? caught.message
        : "No se pudo completar la operación",
    );
  }
  async function mutate(path: string, options: RequestInit) {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(path, options);
      try {
        await load();
        setMessage("Cambios guardados.");
      } catch {
        setMessage("Los cambios se guardaron, pero no pudimos actualizar la lista. Recargá el panel para verlos; no hace falta volver a enviarlos.");
      }
      return true;
    } catch (caught) {
      handleError(caught);
      return false;
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  }

  if (!data)
    return (
      <div className={styles.card} role={error ? "alert" : "status"}>
        <p>{error || "Cargando herramientas de crecimiento…"}</p>
        {error && <button className={`${styles.button} mt-4`} onClick={() => { setError(""); void load().catch(handleError); }} type="button">Reintentar</button>}
      </div>
    );
  const pro = (feature: string) => data.features.includes(feature);

  return (
    <div className={`${styles.surface} mx-auto max-w-7xl space-y-6`}>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6E3482]">
          Crecimiento
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          Hacé crecer tu tienda, paso a paso
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
          Elegí una herramienta. Te explicamos para qué sirve y cómo configurarla, con ejemplos en cada campo.
        </p>
      </header>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </p>
      )}

      <div className={styles.shell}>
        <aside className={styles.navigation}>
          <nav aria-label="Herramientas de crecimiento" className={styles.navItems}>
            {sections.map((item) => <button key={item.id} type="button" className={styles.navButton} aria-current={section === item.id ? "true" : undefined} aria-controls={`growth-${item.id}`} onClick={() => { setSection(item.id); setMessage(""); setError(""); }}>
              <span className={styles.navIcon}><item.icon size={17} aria-hidden="true" /></span>
              <span><span className="block text-xs font-semibold sm:text-sm">{item.label}</span><span className="mt-1 hidden text-[11px] leading-4 text-[#9a8e9d] sm:block">{item.description}</span></span>
            </button>)}
          </nav>
          <div className="hidden xl:block"><Tip title="A tu ritmo">No necesitás configurar todo hoy. Cada formulario se guarda por separado; completá solo lo que necesite tu tienda.</Tip></div>
        </aside>
        <div className={styles.content}>
          {!canManage && <Tip title="Acceso de consulta">Podés ver estas herramientas. Para guardar cambios necesitás permisos de OWNER o ADMIN.</Tip>}
          <fieldset disabled={busy || !canManage} className="min-w-0" aria-busy={busy}>
      <section id="growth-analytics" hidden={section !== "analytics"}>
        <Title
          title={`Resultados de los últimos ${data.analytics.periodDays} días`}
        />
        <p className="mt-2 text-sm leading-6 text-[#807384]">{sections[0].help}</p>
        {!pro("ADVANCED_ANALYTICS") && <Tip title="Más detalle con Pro">El ranking de productos más vendidos está disponible en el plan Pro. Revisá las opciones en <GuideLink onClick={() => onNavigate("plan")}>Plan y uso</GuideLink>.</Tip>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Visitas"
            help="Aperturas registradas de la tienda; una persona puede sumar varias."
            value={data.analytics.events.STOREFRONT_VIEW ?? 0}
          />
          <Metric
            label="Vistas de productos"
            help="Veces que se abrió el detalle de un producto."
            value={data.analytics.events.PRODUCT_VIEW ?? 0}
          />
          <Metric label="Pedidos" value={data.analytics.orders} help="Compras creadas en este período, aunque todavía no estén pagadas." />
          <Metric
            label="Ventas aprobadas"
            help="Importe de los pedidos con pago aprobado."
            value={money(data.analytics.revenueInCents)}
          />
        </div>
        {pro("ADVANCED_ANALYTICS") && (
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5">
            <p className="font-semibold">Productos con más ventas</p>
            <div className="mt-3 space-y-2 text-sm">
              {data.analytics.topProducts.length === 0 && <EmptyState title="Todavía no hay productos en el ranking">Cuando haya ventas registradas en este período, aparecerán acá.</EmptyState>}
              {data.analytics.topProducts.map((item) => (
                <div className="flex justify-between" key={item.productName}>
                  <span>{item.productName}</span>
                  <span>
                    {item._sum.quantity ?? 0} uds. ·{" "}
                    {money(item._sum.subtotalInCents ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <Tip title="Un pedido no siempre es una venta cobrada">Por ejemplo: una compra de $17.000 pendiente de pago suma un pedido, pero no aumenta las ventas aprobadas hasta confirmar el pago.</Tip>
      </section>

      <section id="growth-coupons" hidden={section !== "coupons"}>
        <Title onOpenPlan={() => onNavigate("plan")} title="Cupones y promociones" pro={!pro("COUPONS_PROMOTIONS")} />
        <p className="mt-2 text-sm leading-6 text-[#807384]">{sections[1].help}</p>
        {pro("COUPONS_PROMOTIONS") && (
          <>
            <form
              className={styles.form}
              onSubmit={async (event) => {
                event.preventDefault();
                const element = event.currentTarget;
                const form = new FormData(element);
                const saved = await mutate("/admin/growth/coupons", {
                  method: "POST",
                  body: JSON.stringify({
                    code: form.get("code"),
                    name: form.get("name"),
                    type: form.get("type"),
                    value: form.get("type") === "FIXED" ? Math.round(Number(form.get("value")) * 100) : Number(form.get("value")),
                    minimumInCents: Math.round(Number(form.get("minimum")) * 100),
                    maximumUses: form.get("maximumUses")
                      ? Number(form.get("maximumUses"))
                      : null,
                    active: true,
                  }),
                });
                if (saved) { element.reset(); setCouponType("PERCENTAGE"); }
              }}
            >
              <Input name="code" label="Código del cupón" help="Es lo que escribe tu cliente al comprar." placeholder="VERANO20" />
              <Input name="name" label="Nombre de la promoción" help="Te ayuda a identificar esta campaña en el panel." placeholder="Promo verano" />
              <Field label="Tipo de descuento" help="Elegí entre un porcentaje o una suma fija en pesos." example="20% de descuento o $2.000 menos."><select name="type" value={couponType} onChange={(event) => setCouponType(event.target.value)}>
                <option value="PERCENTAGE">Porcentaje</option>
                <option value="FIXED">Monto fijo en pesos</option>
              </select></Field>
              <Input name="value" label={couponType === "FIXED" ? "Descuento en pesos" : "Porcentaje de descuento"} help={couponType === "FIXED" ? "Ingresá pesos, no centavos." : "Ingresá un valor entre 1 y 100."} placeholder={couponType === "FIXED" ? "2000" : "20"} type="number" min={couponType === "FIXED" ? 0.01 : 1} max={couponType === "PERCENTAGE" ? 100 : undefined} step={couponType === "FIXED" ? "0.01" : "1"} />
              <Input
                name="minimum"
                label="Compra mínima en pesos (opcional)" help="Es el subtotal necesario para usar el cupón. Vacío o 0: sin mínimo." placeholder="10000" required={false} step="0.01"
                type="number"
              />
              <Input name="maximumUses" label="Cantidad máxima de usos (opcional)" help="Límite total para esta promoción. Dejalo vacío para no limitar los usos." placeholder="50" type="number" min={1} required={false} />
              <div className={styles.footer}><Button disabled={!canManage}>Crear cupón</Button></div>
            </form>
            <Tip title="Ejemplo de promoción">VERANO20 con 20% de descuento y compra mínima de $10.000 permite descontar $2.000 sobre un subtotal de $10.000.</Tip>
            <Cards>
              {data.coupons.length === 0 && <EmptyState title="Todavía no creaste cupones">Completá el formulario para crear tu primera promoción.</EmptyState>}
              {data.coupons.map((coupon) => (
                <Card
                  key={coupon.id}
                  title={`${coupon.code} · ${coupon.name}`}
                  text={`${coupon.type === "PERCENTAGE" ? `${coupon.value}%` : money(coupon.value)} · ${coupon.usedCount} usos`}
                  onDelete={
                    canManage
                      ? () =>
                          void mutate(`/admin/growth/coupons/${coupon.id}`, {
                            method: "DELETE",
                          })
                      : undefined
                  }
                />
              ))}
            </Cards>
          </>
        )}
      </section>

      <section id="growth-variants" hidden={section !== "variants"}>
        <Title onOpenPlan={() => onNavigate("plan")} title="Variantes de productos" pro={!pro("PRODUCT_VARIANTS")} />
        <p className="mt-2 text-sm leading-6 text-[#807384]">{sections[2].help}</p>
        {pro("PRODUCT_VARIANTS") && (
          <>
            <form
              className={styles.form}
              onSubmit={async (event) => {
                event.preventDefault();
                const element = event.currentTarget;
                const form = new FormData(element);
                const saved = await mutate("/admin/growth/variants", {
                  method: "POST",
                  body: JSON.stringify({
                    productId: form.get("productId"),
                    sku: form.get("sku"),
                    name: form.get("name"),
                    options: { opción: form.get("name") },
                    priceInCents: Math.round(Number(form.get("price")) * 100),
                    stock: Number(form.get("stock")),
                    active: true,
                  }),
                });
                if (saved) element.reset();
              }}
            >
              <Field label="Producto" help="Elegí el producto al que pertenece esta opción." example="Ejemplo: Remera básica."><select name="productId" required>
                <option value="">Seleccioná un producto</option>
                {data.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select></Field>
              <Input name="sku" label="Código interno (SKU)" help="Identificador único para distinguir esta variante en tu inventario." placeholder="REM-NEG-M" />
              <Input name="name" label="Nombre de la variante" help="La opción que verá el cliente al elegir el producto." placeholder="Negro / M" />
              <Input name="price" label="Precio en pesos" help="Precio completo de esta variante, no un recargo." placeholder="15000" type="number" step="0.01" />
              <Input name="stock" label="Unidades disponibles" help="Cantidad que tenés de esta opción. Usá 0 si no hay stock." placeholder="12" type="number" />
              <div className={styles.footer}><Button disabled={!canManage || !data.products.length}>Crear variante</Button></div>
            </form>
            {!data.products.length && <Tip title="Primero necesitás un producto">Crealo en <GuideLink onClick={() => onNavigate("products")}>Productos</GuideLink> y después agregale acá sus opciones de talle, color o presentación.</Tip>}
            <Cards>
              {data.variants.length === 0 && <EmptyState title="Sin variantes todavía">Ejemplo: para una remera podés crear Negro / M y Negro / L, cada una con su stock.</EmptyState>}
              {data.variants.map((variant) => (
                <Card
                  key={variant.id}
                  title={`${variant.product.name} · ${variant.name}`}
                  text={`${variant.sku} · ${money(variant.priceInCents)} · ${variant.stock} uds.`}
                  onDelete={
                    canManage
                      ? () =>
                          void mutate(`/admin/growth/variants/${variant.id}`, {
                            method: "DELETE",
                          })
                      : undefined
                  }
                />
              ))}
            </Cards>
          </>
        )}
      </section>

      <section id="growth-shipping" hidden={section !== "shipping"}>
        <Title title="Métodos y zonas de envío" />
        <p className="mt-2 text-sm leading-6 text-[#807384]">{sections[3].help}</p>
        <form
          className={styles.form}
          onSubmit={async (event) => {
            event.preventDefault();
            const element = event.currentTarget;
            const form = new FormData(element);
            const saved = await mutate("/admin/growth/shipping-zones", {
              method: "POST",
              body: JSON.stringify({
                name: form.get("name"),
                postalPrefixes: String(form.get("prefixes") ?? "")
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
                active: true,
              }),
            });
            if (saved) element.reset();
          }}
        >
          <Input name="name" label="1. Nombre de la zona" help="Un nombre para reconocer el área en la que entregás." placeholder="CABA" />
          <Input name="prefixes" label="Prefijos de códigos postales (opcional)" help="Separalos con comas. Se comparan con el inicio del código postal del cliente. Vacío: cualquier código." placeholder="C, 1000, 1001" required={false} />
          <div className={styles.footer}><Button disabled={!canManage}>Crear zona</Button></div>
        </form>
        <Tip title="2. Agregá una forma de entrega">Crear una zona no alcanza: agregale abajo un método como Mensajería o Retiro en local. Podés definir costo $0 para una entrega gratis.</Tip>
        <div className="mt-5 grid gap-4">
          {data.shippingZones.length === 0 && <EmptyState title="Todavía no hay zonas">Creá una zona y después agregá sus métodos de entrega.</EmptyState>}
          {data.shippingZones.map((zone) => (
            <article
              className="rounded-2xl border border-stone-200 bg-white p-5"
              key={zone.id}
            >
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold">{zone.name}</p>
                  <p className="text-xs text-stone-400">
                    {zone.postalPrefixes.join(", ") || "Todo el país"}
                  </p>
                </div>
                {canManage && (
                  <button
                    className="text-xs font-semibold text-red-600"
                    onClick={() =>
                      void mutate(`/admin/growth/shipping-zones/${zone.id}`, {
                        method: "DELETE",
                      })
                    }
                  >
                    Eliminar
                  </button>
                )}
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {zone.methods.map((method) => (
                  <p key={method.id}>
                    {method.name} · {money(method.priceInCents)}{" "}
                    {method.estimatedDays
                      ? `· ${method.estimatedDays} días`
                      : ""}
                  </p>
                ))}
              </div>
              <form
                className={styles.form}
                onSubmit={async (event) => {
                  event.preventDefault();
                  const element = event.currentTarget;
                  const form = new FormData(element);
                  const saved = await mutate(
                    `/admin/growth/shipping-zones/${zone.id}/methods`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        name: form.get("name"),
                        priceInCents: Math.round(Number(form.get("price")) * 100),
                        estimatedDays: form.get("days")
                          ? Number(form.get("days"))
                          : null,
                        active: true,
                      }),
                    },
                  );
                  if (saved) element.reset();
                }}
              >
                <Input name="name" label="Nombre del método" help="Lo verá el cliente al elegir el envío." placeholder="Mensajería a domicilio" />
                <Input name="price" label="Costo en pesos" help="Se suma al total de la compra. 0 significa gratis." placeholder="3500" type="number" step="0.01" />
                <Input name="days" label="Días estimados (opcional)" help="Plazo orientativo de entrega, en días enteros." placeholder="3" type="number" min={1} required={false} />
                <div className={styles.footer}><Button disabled={!canManage}>Agregar método</Button></div>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section id="growth-domains" hidden={section !== "domains"}>
        <Title onOpenPlan={() => onNavigate("plan")} title="Dominios personalizados" pro={!pro("CUSTOM_DOMAIN")} />
        <p className="mt-2 text-sm leading-6 text-[#807384]">{sections[4].help}</p>
        {pro("CUSTOM_DOMAIN") && (
          <>
            <form
              className={styles.form}
              onSubmit={async (event) => {
                event.preventDefault();
                const element = event.currentTarget;
                const form = new FormData(element);
                const saved = await mutate("/admin/growth/domains", {
                  method: "POST",
                  body: JSON.stringify({ hostname: form.get("hostname") }),
                });
                if (saved) element.reset();
              }}
            >
              <Input name="hostname" label="Tu dominio" help="Ingresá solo el dominio, sin https:// ni rutas al final." placeholder="tienda.mimarca.com.ar" />
              <div className={styles.footer}><Button disabled={!canManage}>Agregar dominio</Button></div>
            </form>
            <Tip title="Después de agregarlo">Creá en tu proveedor DNS el registro TXT que aparece debajo, copiando exactamente su nombre y valor. Luego tocá Verificar DNS. Esto comprueba la propiedad; no reemplaza la configuración de dirección web y HTTPS.</Tip>
            <Cards>
              {data.domains.length === 0 && <EmptyState title="Todavía no vinculaste un dominio">Tu dirección habitual de InfinityShop sigue funcionando.</EmptyState>}
              {data.domains.map((domain) => (
                <Card
                  key={domain.id}
                  title={`${domain.hostname} · ${{ VERIFIED: "Verificado", PENDING: "Pendiente", FAILED: "No verificado" }[domain.status] ?? "En revisión"}`}
                  text={`TXT _infinityshop.${domain.hostname} = ${domain.verificationToken}${domain.failureReason ? ` · ${domain.failureReason}` : ""}`}
                  action={
                    canManage && domain.status !== "VERIFIED" ? (
                      <button
                        className="text-xs font-semibold text-[#6E3482]"
                        onClick={() =>
                          void mutate(
                            `/admin/growth/domains/${domain.id}/verify`,
                            { method: "POST" },
                          )
                        }
                      >
                        Verificar DNS
                      </button>
                    ) : undefined
                  }
                  onDelete={
                    canManage
                      ? () =>
                          void mutate(`/admin/growth/domains/${domain.id}`, {
                            method: "DELETE",
                          })
                      : undefined
                  }
                />
              ))}
            </Cards>
          </>
        )}
      </section>

      <section id="growth-notifications" hidden={section !== "notifications"}>
        <Title onOpenPlan={() => onNavigate("plan")} title="Notificaciones automáticas" pro={!pro("AUTOMATIONS")} />
        <p className="mt-2 text-sm leading-6 text-[#807384]">{sections[5].help}</p>
        {pro("AUTOMATIONS") && (
          <div className="mt-6 grid gap-5">
            {[
              "ORDER_CREATED",
              "ORDER_PAID",
              "ORDER_SHIPPED",
              "CART_ABANDONED",
            ].map((eventName) => {
              const rule = data.notificationRules.find(
                ({ event }) => event === eventName,
              );
              const copy = notificationCopy[eventName];
              return (
                <form
                  className={styles.card}
                  key={eventName}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void mutate(
                      `/admin/growth/notification-rules/${eventName}`,
                      {
                        method: "PUT",
                        body: JSON.stringify({
                          active: form.get("active") === "on",
                          subject: form.get("subject"),
                          message: form.get("message"),
                        }),
                      },
                    );
                  }}
                >
                  <p className="font-semibold">{copy.title}</p>
                  <p className="mt-1 text-xs leading-6 text-[#807384]">{copy.help}</p>
                  <div className="mt-5 space-y-5"><Input
                    defaultValue={rule?.subject}
                    name="subject"
                    label="Asunto del correo" help="Es el título que aparece en la bandeja de entrada."
                    placeholder={copy.subject}
                  />
                  <Field label="Mensaje" help="Escribí el texto que querés que reciba tu cliente." example={`Ejemplo: ${copy.message}`}><textarea
                    defaultValue={rule?.message}
                    name="message"
                    placeholder={copy.message}
                    required
                  /></Field></div>
                  <label className="my-5 flex items-start gap-3 rounded-xl bg-[#faf7fc] p-4 text-sm">
                    <input
                      className="mt-1 accent-[#6E3482]"
                      defaultChecked={rule?.active ?? true}
                      name="active"
                      type="checkbox"
                    />{" "}
                    <span><span className="block font-medium">Enviar este correo automáticamente</span><span className="mt-1 block text-xs leading-5 text-[#807384]">Si lo desmarcás y guardás, se dejan de generar nuevos correos de este tipo. Los que ya estén en cola no se cancelan.</span></span>
                  </label>
                  <div className={styles.footer}><Button disabled={!canManage}>Guardar mensaje</Button></div>
                </form>
              );
            })}
          </div>
        )}
      </section>

      <section id="growth-carts" hidden={section !== "carts"}>
        <Title
          onOpenPlan={() => onNavigate("plan")}
          title="Recuperación de carritos"
          pro={!pro("ABANDONED_CART_RECOVERY")}
        />
        <p className="mt-2 text-sm leading-6 text-[#807384]">{sections[6].help}</p>
        {pro("ABANDONED_CART_RECOVERY") && (
          <Cards>
            {data.abandonedCarts.length === 0 && <EmptyState title="No hay carritos para recuperar">Cuando se registren compras abandonadas aparecerán acá. Solo podés enviar un recordatorio si el cliente dejó su email.</EmptyState>}
            {data.abandonedCarts.map((cart) => (
              <Card
                key={cart.id}
                title={cart.recoveryEmail ?? "Sin email"}
                text={`${cart.items.map((item) => `${item.product.name} × ${item.quantity}`).join(", ")} · ${new Date(cart.updatedAt).toLocaleString("es-AR")}`}
                action={
                  canManage && cart.recoveryEmail ? (
                    <button
                      className="text-xs font-semibold text-[#6E3482]"
                      onClick={() =>
                        void mutate(
                          `/admin/growth/abandoned-carts/${cart.id}/recover`,
                          { method: "POST" },
                        )
                      }
                    >
                      Enviar recuperación
                    </button>
                  ) : undefined
                }
              />
            ))}
          </Cards>
        )}
      </section>
          </fieldset>
          {busy && <p role="status" className="mt-4 text-sm text-[#6E3482]">Guardando cambios…</p>}
        </div>
      </div>
    </div>
  );
}

function Title({ title, pro, onOpenPlan }: { title: string; pro?: boolean; onOpenPlan?: () => void }) {
  return (
    <div>
      <h3 className="text-xl font-semibold tracking-tight text-[#2b202e]">{title}</h3>
      {pro && (
        <Tip title="Disponible con Pro">Esta herramienta requiere el plan Pro. Podés consultar las opciones en {onOpenPlan ? <GuideLink onClick={onOpenPlan}>Plan y uso</GuideLink> : "Plan y uso"}.</Tip>
      )}
    </div>
  );
}
function Metric({ label, value, help }: { label: string; value: string | number; help: string }) {
  return (
    <article className={styles.card}>
      <p className="text-xs text-[#807384]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      <p className="mt-3 text-xs leading-5 text-[#918495]">{help}</p>
    </article>
  );
}
function Cards({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 grid gap-3 lg:grid-cols-2">{children}</div>;
}
function Card({
  title,
  text,
  action,
  onDelete,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
  onDelete?: () => void;
}) {
  return (
    <article className={styles.card}>
      <div className="flex flex-wrap justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 break-words text-xs leading-5 text-[#807384] [overflow-wrap:anywhere]">
            {text}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {action}
          {onDelete && (
            <button
              className="text-xs font-semibold text-red-600"
              onClick={onDelete}
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
function Input({
  name,
  label,
  help,
  placeholder,
  type = "text",
  defaultValue,
  required = true,
  min = 0,
  max,
  step = "1",
}: {
  name: string;
  label: string;
  help: string;
  placeholder: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <Field label={label} help={help} example={`Ejemplo: ${placeholder}`}><input
      defaultValue={defaultValue}
      min={type === "number" ? min : undefined}
      max={max}
      step={type === "number" ? step : undefined}
      name={name}
      placeholder={placeholder}
      required={required}
      type={type}
    /></Field>
  );
}
function Button({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      className={styles.button}
      disabled={disabled}
      type="submit"
    >
      {children}
    </button>
  );
}
