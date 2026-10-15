import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useSeo } from '@/hooks/useSeo'

const links = [
  { label: 'Curtains, Blinds & Décor', to: '/products' },
  { label: 'Our Services', to: '/services' },
  { label: 'Portfolio', to: '/portfolio' },
  { label: 'Contact Us', to: '/contact' },
]

/** Branded 404 for any unknown URL — kept out of the index, with ways back into the site. */
export default function NotFound() {
  useSeo({
    title: 'Page Not Found',
    description: 'The page you’re looking for doesn’t exist or has moved.',
    noIndex: true,
  })
  return (
    <section className="bg-ivory">
      <div className="container flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
        <span className="eyebrow">
          <span className="rule-gold" />
          Error 404
          <span className="rule-gold" />
        </span>
        <h1 className="mt-5 font-serif text-4xl font-semibold text-forest md:text-5xl">Page not found</h1>
        <p className="mt-4 max-w-md text-forest/60">
          The page you’re looking for doesn’t exist or may have moved. Try one of these instead.
        </p>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
          {links.map((l) => (
            <li key={l.to}>
              <Link to={l.to} className="text-forest underline decoration-gold/60 underline-offset-4 hover:text-gold">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <Button to="/" variant="outlineForest">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        </div>
      </div>
    </section>
  )
}
