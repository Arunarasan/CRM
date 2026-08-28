package com.arudra.crm.service;

import com.arudra.crm.dto.website.PublicCatalogDto.*;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Read side of the public website catalog. Maps entities to non-sensitive public views and
 * parses JSON-backed fields into real arrays/objects. Content is admin-managed; the public
 * endpoints only ever read active, non-deleted rows.
 */
@org.springframework.stereotype.Service
public class WebsiteCatalogService {

    private final ShopProductRepository productRepo;
    private final ShopCategoryRepository categoryRepo;
    private final ServiceRepository serviceRepo;
    private final PortfolioProjectRepository portfolioRepo;
    private final MaterialRepository materialRepo;
    private final HeroSlideRepository heroRepo;
    private final TestimonialRepository testimonialRepo;
    private final ObjectMapper mapper = new ObjectMapper();

    public WebsiteCatalogService(ShopProductRepository productRepo, ShopCategoryRepository categoryRepo,
                                 ServiceRepository serviceRepo, PortfolioProjectRepository portfolioRepo,
                                 MaterialRepository materialRepo, HeroSlideRepository heroRepo,
                                 TestimonialRepository testimonialRepo) {
        this.productRepo = productRepo;
        this.categoryRepo = categoryRepo;
        this.serviceRepo = serviceRepo;
        this.portfolioRepo = portfolioRepo;
        this.materialRepo = materialRepo;
        this.heroRepo = heroRepo;
        this.testimonialRepo = testimonialRepo;
    }

    private Object parseJson(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return mapper.readValue(json, Object.class);
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return mapper.readValue(json, List.class);
        } catch (Exception e) {
            return List.of();
        }
    }

    // ---- Categories ----
    public List<CategoryView> categories() {
        return categoryRepo.findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc()
                .stream().map(this::toCategory).collect(Collectors.toList());
    }

    private CategoryView toCategory(ShopCategory c) {
        return new CategoryView(c.getId(), c.getName(), c.getSlug(), c.getIcon());
    }

    // ---- Products ----
    public List<ProductView> products() {
        return productRepo.findByActiveTrueAndIsDeletedFalseOrderByIdDesc()
                .stream().map(this::toProduct).collect(Collectors.toList());
    }

    public List<ProductView> featuredProducts() {
        return productRepo.findByFeaturedTrueAndActiveTrueAndIsDeletedFalseOrderByIdDesc()
                .stream().map(this::toProduct).collect(Collectors.toList());
    }

    public ProductView product(String slug) {
        return productRepo.findBySlugAndActiveTrueAndIsDeletedFalse(slug).map(this::toProduct).orElse(null);
    }

    private ProductView toProduct(ShopProduct p) {
        String categorySlug = p.getCategory() != null ? p.getCategory().getSlug() : null;
        return new ProductView(
                p.getId(), p.getName(), p.getSlug(), p.getSku(), categorySlug,
                p.getShortDescription(), p.getDescription(), p.getImageUrl(),
                p.getPrice(), p.getDiscountPrice(),
                p.getRating(), p.getReviewCount(), p.getFeatured(),
                p.getStock() != null && p.getStock() > 0,
                p.getMaterial(), p.getDimensions(),
                parseStringList(p.getGalleryJson()), parseJson(p.getSpecificationsJson()));
    }

    // ---- Services ----
    public List<ServiceView> services() {
        return serviceRepo.findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc()
                .stream().map(this::toService).collect(Collectors.toList());
    }

    public ServiceView service(String slug) {
        return serviceRepo.findBySlugAndIsDeletedFalse(slug).map(this::toService).orElse(null);
    }

    private ServiceView toService(com.arudra.crm.entity.Service s) {
        return new ServiceView(
                s.getId(), s.getTitle(), s.getSlug(), s.getShortDescription(), s.getImageUrl(), s.getIcon(),
                s.getOverview(), s.getBenefits(), s.getMaterialsList(),
                parseJson(s.getProcessJson()), parseJson(s.getFaqJson()));
    }

    // ---- Portfolio ----
    public List<PortfolioView> portfolio() {
        return portfolioRepo.findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc()
                .stream().map(this::toPortfolio).collect(Collectors.toList());
    }

    public PortfolioView portfolioProject(String slug) {
        return portfolioRepo.findBySlugAndIsDeletedFalse(slug).map(this::toPortfolio).orElse(null);
    }

    private PortfolioView toPortfolio(PortfolioProject p) {
        return new PortfolioView(
                p.getId(), p.getTitle(), p.getSlug(), p.getCategory(), p.getLocation(), p.getYear(),
                p.getCoverImage(), p.getConcept(), parseStringList(p.getGalleryJson()),
                p.getMaterialsList(), p.getServicesList(), p.getHighlights(),
                parseJson(p.getTestimonialJson()));
    }

    // ---- Materials ----
    public List<MaterialView> materials() {
        return materialRepo.findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc()
                .stream().map(this::toMaterial).collect(Collectors.toList());
    }

    public MaterialView material(String slug) {
        return materialRepo.findBySlugAndIsDeletedFalse(slug).map(this::toMaterial).orElse(null);
    }

    private MaterialView toMaterial(Material m) {
        return new MaterialView(
                m.getId(), m.getName(), m.getSlug(), m.getCategory(), m.getImageUrl(),
                m.getDescription(), m.getFinish(), m.getColor(), m.getApplications());
    }

    // ---- Hero slides ----
    public List<HeroSlideView> heroSlides() {
        return heroRepo.findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc()
                .stream().map(h -> new HeroSlideView(
                        h.getId(), h.getImageUrl(), h.getEyebrow(), h.getTitle(), h.getTitleAccent(),
                        h.getDescription(), h.getPrimaryButtonText(), h.getPrimaryButtonLink(),
                        h.getSecondaryButtonText(), h.getSecondaryButtonLink()))
                .collect(Collectors.toList());
    }

    // ---- Testimonials ----
    public List<TestimonialView> testimonials() {
        return testimonialRepo.findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc()
                .stream().map(t -> new TestimonialView(
                        t.getId(), t.getName(), t.getRole(), t.getLocation(), t.getRating(), t.getQuote()))
                .collect(Collectors.toList());
    }

    // convenience for callers needing a BigDecimal default
    public static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }
}
