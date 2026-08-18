"use client";

import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { Role } from "./types";

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

export function GrowthView({ role }: { role: Role }) {
  const [data, setData] = useState<GrowthData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
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
    setError("");
    setMessage("");
    try {
      await apiRequest(path, options);
      await load();
      setMessage("Cambios guardados.");
    } catch (caught) {
      handleError(caught);
    }
  }

  if (!data)
    return (
      <p className="text-sm text-stone-500">
        Cargando herramientas de crecimiento…
      </p>
    );
  const pro = (feature: string) => data.features.includes(feature);

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
          Crecimiento
        </p>
        <h2 className="mt-2 text-3xl font-semibold">
          Herramientas posteriores al piloto
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
          Administrá promociones, variantes, envíos, automatizaciones, dominios
          y métricas desde un único lugar. Las funciones PRO quedan protegidas
          también en el backend.
        </p>
      </header>
      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}
      {message && (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
          {message}
        </p>
      )}

      <section>
        <Title
          title="Analytics de los últimos 30 días"
          pro={!pro("ADVANCED_ANALYTICS")}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Visitas"
            value={data.analytics.events.STOREFRONT_VIEW ?? 0}
          />
          <Metric
            label="Vistas de productos"
            value={data.analytics.events.PRODUCT_VIEW ?? 0}
          />
          <Metric label="Pedidos" value={data.analytics.orders} />
          <Metric
            label="Ventas aprobadas"
            value={money(data.analytics.revenueInCents)}
          />
        </div>
        {pro("ADVANCED_ANALYTICS") && (
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5">
            <p className="font-semibold">Productos con más ventas</p>
            <div className="mt-3 space-y-2 text-sm">
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
      </section>

      <section>
        <Title title="Cupones y promociones" pro={!pro("COUPONS_PROMOTIONS")} />
        {pro("COUPONS_PROMOTIONS") && (
          <>
            <form
              className="mt-4 grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 md:grid-cols-6"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void mutate("/admin/growth/coupons", {
                  method: "POST",
                  body: JSON.stringify({
                    code: form.get("code"),
                    name: form.get("name"),
                    type: form.get("type"),
                    value: Number(form.get("value")),
                    minimumInCents: Number(form.get("minimum")) * 100,
                    maximumUses: form.get("maximumUses")
                      ? Number(form.get("maximumUses"))
                      : null,
                    active: true,
                  }),
                });
                event.currentTarget.reset();
              }}
            >
              <Input name="code" placeholder="VERANO20" />
              <Input name="name" placeholder="Promo verano" />
              <select className="control" name="type">
                <option value="PERCENTAGE">Porcentaje</option>
                <option value="FIXED">Monto fijo (centavos)</option>
              </select>
              <Input name="value" placeholder="20" type="number" />
              <Input
                name="minimum"
                placeholder="Compra mínima $"
                type="number"
              />
              <Button disabled={!canManage}>Crear cupón</Button>
            </form>
            <Cards>
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

      <section>
        <Title title="Variantes de productos" pro={!pro("PRODUCT_VARIANTS")} />
        {pro("PRODUCT_VARIANTS") && (
          <>
            <form
              className="mt-4 grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 md:grid-cols-6"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void mutate("/admin/growth/variants", {
                  method: "POST",
                  body: JSON.stringify({
                    productId: form.get("productId"),
                    sku: form.get("sku"),
                    name: form.get("name"),
                    options: { opción: form.get("name") },
                    priceInCents: Number(form.get("price")) * 100,
                    stock: Number(form.get("stock")),
                    active: true,
                  }),
                });
                event.currentTarget.reset();
              }}
            >
              <select className="control" name="productId" required>
                <option value="">Producto</option>
                {data.products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <Input name="sku" placeholder="SKU" />
              <Input name="name" placeholder="Ej. Negro / M" />
              <Input name="price" placeholder="Precio $" type="number" />
              <Input name="stock" placeholder="Stock" type="number" />
              <Button disabled={!canManage}>Crear variante</Button>
            </form>
            <Cards>
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

      <section>
        <Title title="Métodos y zonas de envío" />
        <form
          className="mt-4 grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void mutate("/admin/growth/shipping-zones", {
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
            event.currentTarget.reset();
          }}
        >
          <Input name="name" placeholder="AMBA" />
          <Input name="prefixes" placeholder="C, B, 1000 (vacío = todo)" />
          <Button disabled={!canManage}>Crear zona</Button>
        </form>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                className="mt-4 grid gap-2 sm:grid-cols-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void mutate(
                    `/admin/growth/shipping-zones/${zone.id}/methods`,
                    {
                      method: "POST",
                      body: JSON.stringify({
                        name: form.get("name"),
                        priceInCents: Number(form.get("price")) * 100,
                        estimatedDays: form.get("days")
                          ? Number(form.get("days"))
                          : null,
                        active: true,
                      }),
                    },
                  );
                  event.currentTarget.reset();
                }}
              >
                <Input name="name" placeholder="Correo" />
                <Input name="price" placeholder="Precio $" type="number" />
                <Input name="days" placeholder="Días" type="number" />
                <Button disabled={!canManage}>Agregar</Button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section>
        <Title title="Dominios personalizados" pro={!pro("CUSTOM_DOMAIN")} />
        {pro("CUSTOM_DOMAIN") && (
          <>
            <form
              className="mt-4 flex gap-3 rounded-2xl border border-stone-200 bg-white p-5"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void mutate("/admin/growth/domains", {
                  method: "POST",
                  body: JSON.stringify({ hostname: form.get("hostname") }),
                });
                event.currentTarget.reset();
              }}
            >
              <Input name="hostname" placeholder="mitienda.com" />
              <Button disabled={!canManage}>Agregar</Button>
            </form>
            <Cards>
              {data.domains.map((domain) => (
                <Card
                  key={domain.id}
                  title={`${domain.hostname} · ${domain.status}`}
                  text={`TXT _infinityshop.${domain.hostname} = ${domain.verificationToken}${domain.failureReason ? ` · ${domain.failureReason}` : ""}`}
                  action={
                    canManage && domain.status !== "VERIFIED" ? (
                      <button
                        className="text-xs font-semibold text-amber-700"
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

      <section>
        <Title title="Notificaciones automáticas" pro={!pro("AUTOMATIONS")} />
        {pro("AUTOMATIONS") && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {[
              "ORDER_CREATED",
              "ORDER_PAID",
              "ORDER_SHIPPED",
              "CART_ABANDONED",
            ].map((eventName) => {
              const rule = data.notificationRules.find(
                ({ event }) => event === eventName,
              );
              return (
                <form
                  className="rounded-2xl border border-stone-200 bg-white p-5"
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
                  <p className="font-semibold">{eventName}</p>
                  <Input
                    defaultValue={rule?.subject}
                    name="subject"
                    placeholder="Asunto"
                  />
                  <textarea
                    className="control mt-3 min-h-24"
                    defaultValue={rule?.message}
                    name="message"
                    placeholder="Mensaje"
                    required
                  />
                  <label className="mt-3 flex gap-2 text-sm">
                    <input
                      defaultChecked={rule?.active ?? true}
                      name="active"
                      type="checkbox"
                    />{" "}
                    Activa
                  </label>
                  <Button disabled={!canManage}>Guardar</Button>
                </form>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <Title
          title="Recuperación de carritos"
          pro={!pro("ABANDONED_CART_RECOVERY")}
        />
        {pro("ABANDONED_CART_RECOVERY") && (
          <Cards>
            {data.abandonedCarts.map((cart) => (
              <Card
                key={cart.id}
                title={cart.recoveryEmail ?? "Sin email"}
                text={`${cart.items.map((item) => `${item.product.name} × ${item.quantity}`).join(", ")} · ${new Date(cart.updatedAt).toLocaleString("es-AR")}`}
                action={
                  canManage && cart.recoveryEmail ? (
                    <button
                      className="text-xs font-semibold text-amber-700"
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
    </div>
  );
}

function Title({ title, pro }: { title: string; pro?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="text-xl font-semibold">{title}</h3>
      {pro && (
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
          Requiere PRO
        </span>
      )}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-sm text-stone-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
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
    <article className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex justify-between gap-4">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 break-all text-xs leading-5 text-stone-400">
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
  placeholder,
  type = "text",
  defaultValue,
}: {
  name: string;
  placeholder: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <input
      className="control mt-3 first:mt-0"
      defaultValue={defaultValue}
      min={type === "number" ? 0 : undefined}
      name={name}
      placeholder={placeholder}
      required
      type={type}
    />
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
      className="mt-3 rounded-xl bg-stone-950 px-4 py-3 text-xs font-bold text-white disabled:opacity-40"
      disabled={disabled}
      type="submit"
    >
      {children}
    </button>
  );
}
