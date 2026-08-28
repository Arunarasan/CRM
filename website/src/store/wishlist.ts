import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Wishlist of product ids. For visitors this persists to localStorage; once customer
 * auth lands (Phase 6) the same interface can sync against the customer account.
 */
interface WishlistState {
  ids: number[]
  toggle: (id: number) => void
  remove: (id: number) => void
  has: (id: number) => boolean
  clear: () => void
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set((state) => ({
          ids: state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [...state.ids, id],
        })),
      remove: (id) => set((state) => ({ ids: state.ids.filter((x) => x !== id) })),
      has: (id) => get().ids.includes(id),
      clear: () => set({ ids: [] }),
    }),
    { name: 'jbdecor-wishlist' },
  ),
)

export const useWishlistCount = () => useWishlist((s) => s.ids.length)
