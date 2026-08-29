import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import Placeholder from '@/pages/Placeholder'
import { getProduct } from '@/data/products'

const Home = lazy(() => import('@/pages/Home'))
const Services = lazy(() => import('@/pages/Services'))
const ServiceDetail = lazy(() => import('@/pages/ServiceDetail'))
const Portfolio = lazy(() => import('@/pages/Portfolio'))
const PortfolioDetail = lazy(() => import('@/pages/PortfolioDetail'))
const Products = lazy(() => import('@/pages/Products'))
const CategoryProducts = lazy(() => import('@/pages/CategoryProducts'))
const Materials = lazy(() => import('@/pages/Materials'))
const MaterialDetail = lazy(() => import('@/pages/MaterialDetail'))
const About = lazy(() => import('@/pages/About'))
const Contact = lazy(() => import('@/pages/Contact'))
const Consultation = lazy(() => import('@/pages/Consultation'))
const DesignStudio = lazy(() => import('@/pages/DesignStudio'))
const ProductDetail = lazy(() => import('@/pages/ProductDetail'))

// Public, no-login project tracking (link-only). Replaces the old login-based customer portal.
const TrackProject = lazy(() => import('@/pages/TrackProject'))

// Sign-in is retained as the staff door to the CRM (the customer portal itself is retired).
const Login = lazy(() => import('@/pages/Login'))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'))

/** Redirect legacy /shop/:slug deep links to the new category → product path. */
function LegacyProductRedirect() {
  const { slug = '' } = useParams()
  const product = getProduct(slug)
  return <Navigate to={product ? `/products/${product.categorySlug}/${product.slug}` : '/products'} replace />
}

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-forest/20 border-t-gold" />
  </div>
)

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public, no-login project tracking (standalone, own chrome) */}
        <Route path="track/:token" element={<TrackProject />} />

        {/* Sign-in (full-screen, outside public chrome) — the staff door to the CRM */}
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />

        {/* Public website */}
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="services/:slug" element={<ServiceDetail />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="portfolio/:slug" element={<PortfolioDetail />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:category" element={<CategoryProducts />} />
          <Route path="products/:category/:slug" element={<ProductDetail />} />
          <Route path="materials" element={<Materials />} />
          <Route path="materials/:slug" element={<MaterialDetail />} />
          <Route path="design-studio" element={<DesignStudio />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="consultation" element={<Consultation />} />
          {/* Legacy shop redirects → catalog */}
          <Route path="shop" element={<Navigate to="/products" replace />} />
          <Route path="shop/:slug" element={<LegacyProductRedirect />} />
          <Route path="cart" element={<Navigate to="/products" replace />} />
          <Route path="checkout" element={<Navigate to="/products" replace />} />
          <Route path="wishlist" element={<Navigate to="/products" replace />} />
          {/* Retired customer portal + self-signup → home (tracking is now link-only, no login) */}
          <Route path="register" element={<Navigate to="/" replace />} />
          <Route path="portal/*" element={<Navigate to="/" replace />} />
          <Route path="privacy" element={<Placeholder title="Privacy Policy" />} />
          <Route path="terms" element={<Placeholder title="Terms of Service" />} />
          <Route path="refund" element={<Placeholder title="Refund Policy" />} />
          <Route path="*" element={<Placeholder title="Page Not Found" note="The page you’re looking for doesn’t exist — but our portfolio does." />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
