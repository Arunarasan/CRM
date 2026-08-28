import { useState } from 'react'
import { cn } from '@/lib/utils'
import { IMAGE_PLACEHOLDER } from '@/config/images'

/**
 * Image with lazy loading, a neutral placeholder, and a gentle fade-in on load.
 * `alt` is required (no optional alt) to keep the site accessible by construction.
 */
export function SmartImage({
  src,
  alt,
  className,
  imgClassName,
}: {
  src: string
  alt: string
  className?: string
  imgClassName?: string
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className={cn('overflow-hidden bg-forest/5', className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          e.currentTarget.src = IMAGE_PLACEHOLDER
          setLoaded(true)
        }}
        className={cn(
          'h-full w-full object-cover transition-all duration-700',
          loaded ? 'scale-100 opacity-100' : 'scale-105 opacity-0',
          imgClassName,
        )}
      />
    </div>
  )
}
