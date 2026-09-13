import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

/**
 * Cart state for the storefront.
 *
 * - Items are stored in React state and mirrored to localStorage so the cart
 *   survives reloads.
 * - The storage key is namespaced per user (id/email) so different accounts on
 *   the same device don't share a cart, and a guest cart stays separate.
 * - Each line item keeps a minimal snapshot of the product (id, title, price,
 *   image, category) plus quantity — enough to render the cart and to build
 *   the order payload without re-fetching.
 */

const CartContext = createContext(null);

const STORAGE_PREFIX = "towelcrafts_cart";

function currentUserKey() {
  try {
    const raw = localStorage.getItem("userInfo");
    if (!raw) return "guest";
    const info = JSON.parse(raw);
    return info?._id || info?.email || "guest";
  } catch {
    return "guest";
  }
}

function storageKey() {
  return `${STORAGE_PREFIX}:${currentUserKey()}`;
}

function readStoredCart() {
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readStoredCart);

  // Persist to localStorage whenever the cart changes.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(items));
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [items]);

  // Normalize a product (from the API/detail page) into a cart line snapshot.
  const toLine = (product, quantity) => ({
    id: product._id ?? product.id,
    title: product.title,
    price: product.price,
    image: product.image,
    category: product.category,
    categoryId: product.categoryId,
    stockQuantity: product.stockQuantity,
    quantity: Math.max(1, parseInt(quantity, 10) || 1),
  });

  const addItem = useCallback((product, quantity = 1) => {
    setItems((prev) => {
      const id = product._id ?? product.id;
      const existing = prev.find((it) => it.id === id);
      if (existing) {
        return prev.map((it) =>
          it.id === id
            ? { ...it, quantity: it.quantity + Math.max(1, parseInt(quantity, 10) || 1) }
            : it
        );
      }
      return [...prev, toLine(product, quantity)];
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const updateQuantity = useCallback((id, quantity) => {
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, quantity: qty } : it)));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const isInCart = useCallback((id) => items.some((it) => it.id === id), [items]);

  const { count, subtotal } = useMemo(() => {
    return items.reduce(
      (acc, it) => {
        acc.count += it.quantity;
        acc.subtotal += (it.price || 0) * it.quantity;
        return acc;
      },
      { count: 0, subtotal: 0 }
    );
  }, [items]);

  const value = useMemo(
    () => ({ items, addItem, removeItem, updateQuantity, clearCart, isInCart, count, subtotal }),
    [items, addItem, removeItem, updateQuantity, clearCart, isInCart, count, subtotal]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return ctx;
}
