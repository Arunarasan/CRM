import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** JB Decor brand logo — gold wordmark on transparent, sits on dark backgrounds. */
export function Logo({ className }: { className?: string; onDark?: boolean }) {
  return (
    <Link to="/" className={cn('inline-flex items-center', className)} aria-label="JB Decor home">
      <img
        src="/jb-decor-logo.png"
        alt="JB Decor"
        className="h-10 w-auto sm:h-11"
        width={3681}
        height={1016}
      />
    </Link>
  )
}
