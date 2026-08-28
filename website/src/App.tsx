import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { CustomerGuard } from '@/components/portal/CustomerGuard'
import { PortalLayout } from '@/components/portal/PortalLayout'
import Placeholder from '@/pages/Placeholder'

const Home = lazy(() => import('@/pages/Home'))
const Services = lazy(() => import('@/pages/Services'))
const ServiceDetail = lazy(() => import('@/pages/ServiceDetail'))
const Portfolio = lazy(() => import('@/pages/Portfolio'))
const PortfolioDetail = lazy(() => import('@/pages/PortfolioDetail'))
const Shop = lazy(() => import('@/pages/Shop'))
const Materials = lazy(() => import('@/pages/Materials'))
const MaterialDetail = lazy(() => import('@/pages/MaterialDetail'))
const About = lazy(() => import('@/pages/About'))
const Contact = lazy(() => import('@/pages/Contact'))
const Consultation = lazy(() => import('@/pages/Consultation'))
const DesignStudio = lazy(() => import('@/pages/DesignStudio'))
const ProductDetail = lazy(() => import('@/pages/ProductDetail'))
const Cart = lazy(() => import('@/pages/Cart'))
const Checkout = lazy(() => import('@/pages/Checkout'))
const Wishlist = lazy(() => import('@/pages/Wishlist'))
const Login = lazy(() => import('@/pages/Login'))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'))

// Customer portal
const PortalDashboard = lazy(() => import('@/pages/portal/Dashboard'))
const PortalProjects = lazy(() => import('@/pages/portal/Projects'))
const PortalProjectDetail = lazy(() => import('@/pages/portal/ProjectDetail'))
const PortalQuotations = lazy(() => import('@/pages/portal/Quotations'))
const PortalInvoices = lazy(() => import('@/pages/portal/Invoices'))
const PortalPayments = lazy(() => import('@/pages/portal/Payments'))
const PortalDocuments = lazy(() => import('@/pages/portal/Documents'))
const PortalServiceRequests = lazy(() => import('@/pages/portal/ServiceRequests'))
const PortalServices = lazy(() => import('@/pages/portal/Services'))
const PortalOrders = lazy(() => import('@/pages/portal/Orders'))
const PortalWishlist = lazy(() => import('@/pages/portal/Wishlist'))
const PortalNotifications = lazy(() => import('@/pages/portal/Notifications'))
const PortalProfile = lazy(() => import('@/pages/portal/Profile'))

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-forest/20 border-t-gold" />
  </div>
)

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public website */}
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="services" element={<Services />} />
          <Route path="services/:slug" element={<ServiceDetail />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="portfolio/:slug" element={<PortfolioDetail />} />
          <Route path="shop" element={<Shop />} />
          <Route path="shop/:slug" element={<ProductDetail />} />
          <Route path="materials" element={<Materials />} />
          <Route path="materials/:slug" element={<MaterialDetail />} />
          <Route path="design-studio" element={<DesignStudio />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="consultation" element={<Consultation />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="privacy" element={<Placeholder title="Privacy Policy" />} />
          <Route path="terms" element={<Placeholder title="Terms of Service" />} />
          <Route path="refund" element={<Placeholder title="Refund Policy" />} />
          <Route path="*" element={<Placeholder title="Page Not Found" note="The page you’re looking for doesn’t exist — but our portfolio does." />} />
        </Route>

        {/* Auth (full-screen, outside public chrome) */}
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />

        {/* Customer portal (protected, own shell) */}
        <Route path="portal" element={<CustomerGuard><PortalLayout /></CustomerGuard>}>
          <Route index element={<PortalDashboard />} />
          <Route path="projects" element={<PortalProjects />} />
          <Route path="projects/:id" element={<PortalProjectDetail />} />
          <Route path="quotations" element={<PortalQuotations />} />
          <Route path="invoices" element={<PortalInvoices />} />
          <Route path="payments" element={<PortalPayments />} />
          <Route path="documents" element={<PortalDocuments />} />
          <Route path="service-requests" element={<PortalServiceRequests />} />
          <Route path="services" element={<PortalServices />} />
          <Route path="orders" element={<PortalOrders />} />
          <Route path="wishlist" element={<PortalWishlist />} />
          <Route path="notifications" element={<PortalNotifications />} />
          <Route path="profile" element={<PortalProfile />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
