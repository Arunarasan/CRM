import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
  variant: 'success' | 'error' | 'info'
}

interface ToastState {
  toasts: Toast[]
  push: (message: string, variant?: Toast['variant']) => void
  dismiss: (id: number) => void
}

let counter = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant = 'success') => {
    const id = ++counter
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Imperative helper so non-component code can raise a toast. */
export const toast = (message: string, variant?: Toast['variant']) =>
  useToastStore.getState().push(message, variant)
