import { cva, type VariantProps } from 'class-variance-authority'
import { Link } from 'react-router-dom'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 font-sans text-sm font-semibold uppercase tracking-wider transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        // Gold background, dark green text — the primary CTA
        primary: 'bg-gold text-forest hover:bg-gold-dark shadow-sm hover:shadow-md',
        // Transparent, gold border, ivory/light text — for dark backgrounds
        outlineGold: 'border border-gold text-ivory hover:bg-gold hover:text-forest',
        // Forest outline — for light backgrounds
        outlineForest: 'border border-forest/25 text-forest hover:border-forest hover:bg-forest hover:text-ivory',
        // Solid forest
        forest: 'bg-forest text-ivory hover:bg-forest-light',
        // Minimal text link with arrow
        ghost: 'text-forest hover:text-gold px-0 tracking-normal normal-case',
      },
      size: {
        sm: 'h-9 px-4 text-xs',
        md: 'h-11 px-6',
        lg: 'h-12 px-6 text-sm sm:h-14 sm:px-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type BaseProps = VariantProps<typeof button> & { className?: string; children: ReactNode }

type ButtonAsButton = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & { to?: undefined }

type ButtonAsLink = BaseProps & { to: string; external?: boolean }

export function Button(props: ButtonAsButton | ButtonAsLink) {
  const { variant, size, className, children } = props
  const classes = cn(button({ variant, size }), className)

  if ('to' in props && props.to !== undefined) {
    const { to, external } = props
    if (external) {
      return (
        <a href={to} target="_blank" rel="noopener noreferrer" className={classes}>
          {children}
        </a>
      )
    }
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    )
  }

  const { variant: _v, size: _s, className: _c, children: _ch, to: _t, ...rest } =
    props as ButtonAsButton
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  )
}
