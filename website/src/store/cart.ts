import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/types'

export interface CartItem {
  id: number
  name: string
  slug: string
  image: string
  sku: string
  price: number // unit price actually charged (discountPrice ?? price)
  qty: number
}

interface CartState {
  items: CartItem[]
  add: (product: Product, qty?: number) => void
  remove: (id: number) => void
  setQty: (id: number, qty: number) => void
  clear: () => void
}

export const DELIVERY_FEE = 1500
export const FREE_DELIVERY_THRESHOLD = 50000

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (product, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.id === product.id)
          const unit = product.discountPrice ?? product.price
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === product.id ? { ...i, qty: i.qty + qty } : i,
              ),
            }
          }
          return {
            items: [
              ...state.items,
              {
                id: product.id,
                name: product.name,
                slug: product.slug,
                image: product.image,
                sku: product.sku,
                price: unit,
                qty,
              },
            ],
          }
        }),
      remove: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
      setQty: (id, qty) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: 'jbdecor-cart' },
  ),
)

/** Derived selectors — call inside components. */
export const useCartCount = () => useCart((s) => s.items.reduce((n, i) => n + i.qty, 0))
export const useCartSubtotal = () => useCart((s) => s.items.reduce((sum, i) => sum + i.price * i.qty, 0))
