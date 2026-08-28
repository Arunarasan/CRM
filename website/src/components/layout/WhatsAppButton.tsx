import { MessageCircle } from 'lucide-react'
import { useWhatsappLink } from '@/hooks/useSiteSettings'

/** Subtle floating WhatsApp button; number comes from CRM-managed settings (with config fallback). */
export function WhatsAppButton() {
  const href = useWhatsappLink('Hello JB Decor, I would like to know more about your interior design services.')
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with JB Decor on WhatsApp"
      className="group fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-full bg-forest py-3 pl-3 pr-4 text-ivory shadow-card-hover ring-1 ring-gold/40 transition-all hover:bg-forest-light"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-forest">
        <MessageCircle className="h-5 w-5" />
      </span>
      <span className="hidden text-sm font-medium sm:inline">Chat with JB Decor</span>
    </a>
  )
}
