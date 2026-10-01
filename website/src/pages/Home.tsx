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
  useSeo({ title: 'Curtains, Blinds, Mosquito Nets & Home Décor', description: 'JB Decor — customised curtains, blinds, mosquito nets, curtain rods, mats, wall décor and interior works. On-site measurement, in-house stitching and professional installation.' })
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
