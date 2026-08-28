import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { heroSlides, heroStats } from '@/data/heroSlides'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/cards/StatCard'
import { SmartImage } from '@/components/ui/SmartImage'

const AUTOPLAY_MS = 6000

export function HeroSlider() {
  const slides = heroSlides.filter((s) => s.active).sort((a, b) => a.displayOrder - b.displayOrder)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const go = useCallback(
    (next: number) => setIndex((next + slides.length) % slides.length),
    [slides.length],
  )

  useEffect(() => {
    if (paused) return
    timer.current = window.setTimeout(() => go(index + 1), AUTOPLAY_MS)
    return () => window.clearTimeout(timer.current)
  }, [index, paused, go])

  const slide = slides[index]

  return (
    <section
      className="relative overflow-hidden bg-forest"
      aria-roledescription="carousel"
      aria-label="JB Decor featured highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(index - 1)
        if (e.key === 'ArrowRight') go(index + 1)
      }}
    >
      {/* Background images (cross-fade) */}
      <div className="absolute inset-0">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={cn(
              'absolute inset-0 transition-opacity duration-1000',
              i === index ? 'opacity-100' : 'opacity-0',
            )}
            aria-hidden={i !== index}
          >
            <SmartImage src={s.image} alt={s.title} className="h-full w-full" imgClassName="h-full" />
          </div>
        ))}
        {/* Forest gradient — strong on the left, fading right */}
        <div className="absolute inset-0 bg-gradient-to-r from-forest-deep via-forest/85 to-forest/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-deep/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="container relative">
        <div className="grid items-center gap-8 py-14 sm:gap-10 sm:py-20 md:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:py-36">
          {/* Copy */}
          <div key={slide.id} className="max-w-xl animate-fade-up">
            <span className="eyebrow">
              <span className="rule-gold" />
              {slide.eyebrow}
            </span>
            <h1 className="mt-4 font-serif text-[2rem] font-semibold leading-[1.1] text-ivory sm:mt-5 sm:text-5xl lg:text-6xl">
              {slide.title} <span className="text-gold">{slide.titleAccent}</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ivory/75 sm:mt-6 sm:text-lg">
              {slide.description}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:gap-4">
              <Button to={slide.primaryButtonLink} variant="primary" size="lg">
                {slide.primaryButtonText} <ArrowRight className="h-4 w-4" />
              </Button>
              <Button to={slide.secondaryButtonLink} variant="outlineGold" size="lg">
                {slide.secondaryButtonText} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Stats — compact 3-up strip on mobile, floating card on desktop */}
          <div className="lg:justify-self-end">
            <div className="w-full border border-gold/30 bg-forest/70 p-4 backdrop-blur-md sm:p-6 lg:max-w-sm lg:translate-x-6 lg:p-7">
              <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:gap-x-6 lg:grid-cols-1 lg:gap-6">
                {heroStats.map((stat) => (
                  <StatCard key={stat.id} stat={stat} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="container relative pb-8">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className={cn(
                  'h-1 rounded-full transition-all duration-300',
                  i === index ? 'w-10 bg-gold' : 'w-5 bg-ivory/30 hover:bg-ivory/50',
                )}
              />
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button
              aria-label="Previous slide"
              onClick={() => go(index - 1)}
              className="flex h-10 w-10 items-center justify-center border border-ivory/25 text-ivory transition-colors hover:border-gold hover:text-gold"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              aria-label="Next slide"
              onClick={() => go(index + 1)}
              className="flex h-10 w-10 items-center justify-center border border-ivory/25 text-ivory transition-colors hover:border-gold hover:text-gold"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
