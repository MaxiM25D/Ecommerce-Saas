"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { CartItem, StorefrontProduct } from "./types";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotalInCents: number;
  addItem: (
    product: StorefrontProduct,
    quantity?: number,
    variant?: StorefrontProduct["variants"][number],
  ) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const storageKey = `infinityshop:cart:${storeSlug}`;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const stored = window.localStorage.getItem(storageKey);
        setItems(stored ? (JSON.parse(stored) as CartItem[]) : []);
      } catch {
        setItems([]);
      } finally {
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (ready) window.localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, ready, storageKey]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      subtotalInCents: items.reduce(
        (total, item) => total + item.priceInCents * item.quantity,
        0,
      ),
      addItem(product, quantity = 1, variant) {
        const purchasable = variant
          ? {
              ...product,
              sku: variant.sku,
              priceInCents: variant.priceInCents,
              stock: variant.stock,
              selectedVariant: variant,
            }
          : product;
        if (purchasable.stock < 1) return;
        setItems((current) => {
          const existing = current.find((item) => item.id === product.id);
          if (!existing)
            return [
              ...current,
              {
                ...purchasable,
                quantity: Math.min(quantity, purchasable.stock),
              },
            ];
          return current.map((item) =>
            item.id === product.id
              ? {
                  ...item,
                  ...purchasable,
                  quantity: Math.min(
                    item.quantity + quantity,
                    purchasable.stock,
                  ),
                }
              : item,
          );
        });
      },
      removeItem(productId) {
        setItems((current) => current.filter((item) => item.id !== productId));
      },
      setQuantity(productId, quantity) {
        setItems((current) =>
          current
            .map((item) =>
              item.id === productId
                ? {
                    ...item,
                    quantity: Math.min(Math.max(quantity, 0), item.stock),
                  }
                : item,
            )
            .filter((item) => item.quantity > 0),
        );
      },
      clear() {
        setItems([]);
      },
    }),
    [items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
