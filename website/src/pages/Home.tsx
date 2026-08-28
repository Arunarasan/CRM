import { HeroSlider } from '@/components/home/HeroSlider'
import { ShopByCategory } from '@/components/home/ShopByCategory'
import { FeaturedProducts } from '@/components/home/FeaturedProducts'
import { DesignYourSpace } from '@/components/home/DesignYourSpace'
import { WhyChooseUs } from '@/components/home/WhyChooseUs'
import { FeaturedPortfolio } from '@/components/home/FeaturedPortfolio'
import { ServicesPreview } from '@/components/home/ServicesPreview'
import { Testimonials } from '@/components/home/Testimonials'
import { ConsultationCTA } from '@/components/home/ConsultationCTA'
import { useSeo } from '@/hooks/useSeo'

export default function Home() {
  useSeo({ title: 'Premium Interior Design & Décor', description: 'JB Decor crafts bespoke luxury interiors — residential, commercial, and turnkey design. Explore our portfolio, shop premium décor, and book a consultation.' })
  return (
    <>
      <HeroSlider />
      <ShopByCategory />
      <FeaturedProducts />
      <DesignYourSpace />
      <WhyChooseUs />
      <FeaturedPortfolio />
      <ServicesPreview />
      <Testimonials />
      <ConsultationCTA />
    </>
  )
}
