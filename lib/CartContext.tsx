"use client";
import { createContext, useContext, useState } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
};

type CartCtx = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">) => void;
  remove: (id: string) => void;
  update: (id: string, quantity: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartCtx>({} as CartCtx);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  function add(item: Omit<CartItem, "quantity">, quantity = 1) {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) return prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i);
      return [...prev, { ...item, quantity }];
    });
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function update(id: string, quantity: number) {
    if (quantity < 1) return remove(id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity } : i));
  }

  function clear() { setItems([]); }

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, add, remove, update, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
