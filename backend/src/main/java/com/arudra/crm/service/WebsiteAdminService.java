package com.arudra.crm.service;

import com.arudra.crm.dto.website.WebsiteAdminDto.*;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import com.arudra.crm.util.SlugUtil;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Predicate;

/**
 * Write side of the website catalog CMS ({@code /api/website/**}). Persists to the very same tables
 * that {@link WebsiteCatalogService} reads for the public site, so an edit here is live on the site
 * on the next public fetch. Handles slug generation/uniqueness, soft-delete, active toggles, ordering,
 * and (de)serialization of the JSON/list-backed columns to structured DTOs.
 */
@Service
public class WebsiteAdminService {

    private final ShopProductRepository productRepo;
    private final ShopCategoryRepository categoryRepo;
    private final ServiceRepository serviceRepo;
    private final MaterialRepository materialRepo;
    private final PortfolioProjectRepository portfolioRepo;
    private final HeroSlideRepository heroRepo;
    private final TestimonialRepository testimonialRepo;
    private final ObjectMapper mapper = new ObjectMapper();

    public WebsiteAdminService(ShopProductRepository productRepo, ShopCategoryRepository categoryRepo,
                               ServiceRepository serviceRepo, MaterialRepository materialRepo,
                               PortfolioProjectRepository portfolioRepo, HeroSlideRepository heroRepo,
                               TestimonialRepository testimonialRepo) {
        this.productRepo = productRepo;
        this.categoryRepo = categoryRepo;
        this.serviceRepo = serviceRepo;
        this.materialRepo = materialRepo;
        this.portfolioRepo = portfolioRepo;
        this.heroRepo = heroRepo;
        this.testimonialRepo = testimonialRepo;
    }

    // =========================================================================================
    // Helpers
    // =========================================================================================

    private String writeJson(Object value) {
        if (value == null) return null;
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception e) {
            return null;
        }
    }

    private <T> T readJson(String json, TypeReference<T> type, T fallback) {
        if (json == null || json.isBlank()) return fallback;
        try {
            return mapper.readValue(json, type);
        } catch (Exception e) {
            return fallback;
        }
    }

    /** Returns a unique slug based on {@code base}, appending -2, -3… while {@code taken} is true. */
    private String uniqueSlug(String desired, String fallbackSource, Predicate<String> taken) {
        String base = (desired != null && !desired.isBlank()) ? SlugUtil.toSlug(desired) : SlugUtil.toSlug(fallbackSource);
        if (base.isBlank()) base = "item";
        String candidate = base;
        int n = 2;
        while (taken.test(candidate)) {
            candidate = base + "-" + n++;
        }
        return candidate;
    }

    private void softDelete(BaseEntity e) {
        e.setIsDeleted(true);
        e.setDeletedAt(LocalDateTime.now());
    }

    // =========================================================================================
    // Categories
    // =========================================================================================

    public List<CategoryDto> listCategories() {
        return categoryRepo.findByIsDeletedFalseOrderByDisplayOrderAsc().stream().map(this::toDto).toList();
    }

    @Transactional
    public CategoryDto createCategory(CategoryDto d) {
        ShopCategory c = new ShopCategory();
        c.setSlug(uniqueSlug(d.slug(), d.name(), categoryRepo::existsBySlugAndIsDeletedFalse));
        applyCategory(c, d);
        return toDto(categoryRepo.save(c));
    }

    @Transactional
    public CategoryDto updateCategory(Long id, CategoryDto d) {
        ShopCategory c = categoryRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Category not found"));
        if (d.slug() != null && !d.slug().isBlank() && !d.slug().equals(c.getSlug())) {
            c.setSlug(uniqueSlug(d.slug(), d.name(), categoryRepo::existsBySlugAndIsDeletedFalse));
        }
        applyCategory(c, d);
        return toDto(categoryRepo.save(c));
    }

    private void applyCategory(ShopCategory c, CategoryDto d) {
        c.setName(d.name());
        c.setIcon(d.icon());
        if (d.displayOrder() != null) c.setDisplayOrder(d.displayOrder());
        if (d.active() != null) c.setActive(d.active());
    }

    @Transactional
    public void deleteCategory(Long id) {
        ShopCategory c = categoryRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Category not found"));
        softDelete(c);
        categoryRepo.save(c);
    }

    @Transactional
    public CategoryDto toggleCategory(Long id) {
        ShopCategory c = categoryRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Category not found"));
        c.setActive(!Boolean.TRUE.equals(c.getActive()));
        return toDto(categoryRepo.save(c));
    }

    private CategoryDto toDto(ShopCategory c) {
        return new CategoryDto(c.getId(), c.getName(), c.getSlug(), c.getIcon(), c.getDisplayOrder(), c.getActive());
    }

    // =========================================================================================
    // Products
    // =========================================================================================

    public List<ProductDto> listProducts() {
        return productRepo.findByIsDeletedFalseOrderByIdDesc().stream().map(this::toDto).toList();
    }

    @Transactional
    public ProductDto createProduct(ProductDto d) {
        ShopProduct p = new ShopProduct();
        p.setSlug(uniqueSlug(d.slug(), d.name(), productRepo::existsBySlugAndIsDeletedFalse));
        applyProduct(p, d);
        return toDto(productRepo.save(p));
    }

    @Transactional
    public ProductDto updateProduct(Long id, ProductDto d) {
        ShopProduct p = productRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Product not found"));
        if (d.slug() != null && !d.slug().isBlank() && !d.slug().equals(p.getSlug())) {
            p.setSlug(uniqueSlug(d.slug(), d.name(), productRepo::existsBySlugAndIsDeletedFalse));
        }
        applyProduct(p, d);
        return toDto(productRepo.save(p));
    }

    private void applyProduct(ShopProduct p, ProductDto d) {
        p.setName(d.name());
        p.setSku(d.sku());
        if (d.categoryId() != null) {
            p.setCategory(categoryRepo.findByIdAndIsDeletedFalse(d.categoryId())
                    .orElseThrow(() -> new EntityNotFoundException("Category not found")));
        } else {
            p.setCategory(null);
        }
        p.setShortDescription(d.shortDescription());
        p.setDescription(d.description());
        p.setImageUrl(d.imageUrl());
        if (d.price() != null) p.setPrice(d.price());
        p.setDiscountPrice(d.discountPrice());
        if (d.stock() != null) p.setStock(d.stock());
        if (d.rating() != null) p.setRating(d.rating());
        if (d.reviewCount() != null) p.setReviewCount(d.reviewCount());
        if (d.featured() != null) p.setFeatured(d.featured());
        if (d.active() != null) p.setActive(d.active());
        p.setMaterial(d.material());
        p.setDimensions(d.dimensions());
        p.setGalleryJson(writeJson(d.gallery()));
        p.setSpecificationsJson(writeJson(d.specifications()));
    }

    @Transactional
    public void deleteProduct(Long id) {
        ShopProduct p = productRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Product not found"));
        softDelete(p);
        productRepo.save(p);
    }

    @Transactional
    public ProductDto toggleProduct(Long id) {
        ShopProduct p = productRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Product not found"));
        p.setActive(!Boolean.TRUE.equals(p.getActive()));
        return toDto(productRepo.save(p));
    }

    private ProductDto toDto(ShopProduct p) {
        return new ProductDto(
                p.getId(), p.getName(), p.getSlug(), p.getSku(),
                p.getCategory() != null ? p.getCategory().getId() : null,
                p.getShortDescription(), p.getDescription(), p.getImageUrl(),
                p.getPrice(), p.getDiscountPrice(), p.getStock(),
                p.getRating(), p.getReviewCount(), p.getFeatured(), p.getActive(),
                p.getMaterial(), p.getDimensions(),
                readJson(p.getGalleryJson(), new TypeReference<List<String>>() {}, List.of()),
                readJson(p.getSpecificationsJson(), new TypeReference<List<SpecRow>>() {}, List.of()));
    }

    // =========================================================================================
    // Services
    // =========================================================================================

    public List<ServiceDto> listServices() {
        return serviceRepo.findByIsDeletedFalseOrderByDisplayOrderAsc().stream().map(this::toDto).toList();
    }

    @Transactional
    public ServiceDto createService(ServiceDto d) {
        com.arudra.crm.entity.Service s = new com.arudra.crm.entity.Service();
        s.setSlug(uniqueSlug(d.slug(), d.title(), serviceRepo::existsBySlugAndIsDeletedFalse));
        applyService(s, d);
        return toDto(serviceRepo.save(s));
    }

    @Transactional
    public ServiceDto updateService(Long id, ServiceDto d) {
        com.arudra.crm.entity.Service s = serviceRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Service not found"));
        if (d.slug() != null && !d.slug().isBlank() && !d.slug().equals(s.getSlug())) {
            s.setSlug(uniqueSlug(d.slug(), d.title(), serviceRepo::existsBySlugAndIsDeletedFalse));
        }
        applyService(s, d);
        return toDto(serviceRepo.save(s));
    }

    private void applyService(com.arudra.crm.entity.Service s, ServiceDto d) {
        s.setTitle(d.title());
        s.setShortDescription(d.shortDescription());
        s.setImageUrl(d.imageUrl());
        s.setIcon(d.icon());
        s.setOverview(d.overview());
        s.setBenefits(d.benefits());
        s.setMaterialsList(d.materialsList());
        s.setProcessJson(writeJson(d.process()));
        s.setFaqJson(writeJson(d.faq()));
        if (d.displayOrder() != null) s.setDisplayOrder(d.displayOrder());
        if (d.active() != null) s.setActive(d.active());
    }

    @Transactional
    public void deleteService(Long id) {
        com.arudra.crm.entity.Service s = serviceRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Service not found"));
        softDelete(s);
        serviceRepo.save(s);
    }

    @Transactional
    public ServiceDto toggleService(Long id) {
        com.arudra.crm.entity.Service s = serviceRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Service not found"));
        s.setActive(!Boolean.TRUE.equals(s.getActive()));
        return toDto(serviceRepo.save(s));
    }

    private ServiceDto toDto(com.arudra.crm.entity.Service s) {
        return new ServiceDto(
                s.getId(), s.getTitle(), s.getSlug(), s.getShortDescription(), s.getImageUrl(), s.getIcon(),
                s.getOverview(), s.getBenefits(), s.getMaterialsList(),
                readJson(s.getProcessJson(), new TypeReference<List<ProcessStep>>() {}, List.of()),
                readJson(s.getFaqJson(), new TypeReference<List<FaqItem>>() {}, List.of()),
                s.getDisplayOrder(), s.getActive());
    }

    // =========================================================================================
    // Materials
    // =========================================================================================

    public List<MaterialDto> listMaterials() {
        return materialRepo.findByIsDeletedFalseOrderByDisplayOrderAsc().stream().map(this::toDto).toList();
    }

    @Transactional
    public MaterialDto createMaterial(MaterialDto d) {
        Material m = new Material();
        m.setSlug(uniqueSlug(d.slug(), d.name(), materialRepo::existsBySlugAndIsDeletedFalse));
        applyMaterial(m, d);
        return toDto(materialRepo.save(m));
    }

    @Transactional
    public MaterialDto updateMaterial(Long id, MaterialDto d) {
        Material m = materialRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Material not found"));
        if (d.slug() != null && !d.slug().isBlank() && !d.slug().equals(m.getSlug())) {
            m.setSlug(uniqueSlug(d.slug(), d.name(), materialRepo::existsBySlugAndIsDeletedFalse));
        }
        applyMaterial(m, d);
        return toDto(materialRepo.save(m));
    }

    private void applyMaterial(Material m, MaterialDto d) {
        m.setName(d.name());
        m.setCategory(d.category());
        m.setImageUrl(d.imageUrl());
        m.setDescription(d.description());
        m.setFinish(d.finish());
        m.setColor(d.color());
        m.setApplications(d.applications());
        if (d.displayOrder() != null) m.setDisplayOrder(d.displayOrder());
        if (d.active() != null) m.setActive(d.active());
    }

    @Transactional
    public void deleteMaterial(Long id) {
        Material m = materialRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Material not found"));
        softDelete(m);
        materialRepo.save(m);
    }

    @Transactional
    public MaterialDto toggleMaterial(Long id) {
        Material m = materialRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Material not found"));
        m.setActive(!Boolean.TRUE.equals(m.getActive()));
        return toDto(materialRepo.save(m));
    }

    private MaterialDto toDto(Material m) {
        return new MaterialDto(
                m.getId(), m.getName(), m.getSlug(), m.getCategory(), m.getImageUrl(),
                m.getDescription(), m.getFinish(), m.getColor(), m.getApplications(),
                m.getDisplayOrder(), m.getActive());
    }

    // =========================================================================================
    // Portfolio
    // =========================================================================================

    public List<PortfolioDto> listPortfolio() {
        return portfolioRepo.findByIsDeletedFalseOrderByDisplayOrderAsc().stream().map(this::toDto).toList();
    }

    @Transactional
    public PortfolioDto createPortfolio(PortfolioDto d) {
        PortfolioProject p = new PortfolioProject();
        p.setSlug(uniqueSlug(d.slug(), d.title(), portfolioRepo::existsBySlugAndIsDeletedFalse));
        applyPortfolio(p, d);
        return toDto(portfolioRepo.save(p));
    }

    @Transactional
    public PortfolioDto updatePortfolio(Long id, PortfolioDto d) {
        PortfolioProject p = portfolioRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Portfolio project not found"));
        if (d.slug() != null && !d.slug().isBlank() && !d.slug().equals(p.getSlug())) {
            p.setSlug(uniqueSlug(d.slug(), d.title(), portfolioRepo::existsBySlugAndIsDeletedFalse));
        }
        applyPortfolio(p, d);
        return toDto(portfolioRepo.save(p));
    }

    private void applyPortfolio(PortfolioProject p, PortfolioDto d) {
        p.setTitle(d.title());
        p.setCategory(d.category());
        p.setLocation(d.location());
        p.setYear(d.year());
        p.setCoverImage(d.coverImage());
        p.setConcept(d.concept());
        p.setMaterialsList(d.materialsList());
        p.setServicesList(d.servicesList());
        p.setHighlights(d.highlights());
        p.setGalleryJson(writeJson(d.gallery()));
        p.setTestimonialJson(writeJson(d.testimonial()));
        if (d.displayOrder() != null) p.setDisplayOrder(d.displayOrder());
        if (d.active() != null) p.setActive(d.active());
    }

    @Transactional
    public void deletePortfolio(Long id) {
        PortfolioProject p = portfolioRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Portfolio project not found"));
        softDelete(p);
        portfolioRepo.save(p);
    }

    @Transactional
    public PortfolioDto togglePortfolio(Long id) {
        PortfolioProject p = portfolioRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Portfolio project not found"));
        p.setActive(!Boolean.TRUE.equals(p.getActive()));
        return toDto(portfolioRepo.save(p));
    }

    private PortfolioDto toDto(PortfolioProject p) {
        return new PortfolioDto(
                p.getId(), p.getTitle(), p.getSlug(), p.getCategory(), p.getLocation(), p.getYear(),
                p.getCoverImage(), p.getConcept(),
                readJson(p.getGalleryJson(), new TypeReference<List<String>>() {}, List.of()),
                p.getMaterialsList(), p.getServicesList(), p.getHighlights(),
                readJson(p.getTestimonialJson(), new TypeReference<TestimonialBlock>() {}, null),
                p.getDisplayOrder(), p.getActive());
    }

    // =========================================================================================
    // Hero slides
    // =========================================================================================

    public List<HeroSlideDto> listHeroSlides() {
        return heroRepo.findByIsDeletedFalseOrderByDisplayOrderAsc().stream().map(this::toDto).toList();
    }

    @Transactional
    public HeroSlideDto createHeroSlide(HeroSlideDto d) {
        HeroSlide h = new HeroSlide();
        applyHero(h, d);
        return toDto(heroRepo.save(h));
    }

    @Transactional
    public HeroSlideDto updateHeroSlide(Long id, HeroSlideDto d) {
        HeroSlide h = heroRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Hero slide not found"));
        applyHero(h, d);
        return toDto(heroRepo.save(h));
    }

    private void applyHero(HeroSlide h, HeroSlideDto d) {
        h.setImageUrl(d.imageUrl());
        h.setEyebrow(d.eyebrow());
        h.setTitle(d.title());
        h.setTitleAccent(d.titleAccent());
        h.setDescription(d.description());
        h.setPrimaryButtonText(d.primaryButtonText());
        h.setPrimaryButtonLink(d.primaryButtonLink());
        h.setSecondaryButtonText(d.secondaryButtonText());
        h.setSecondaryButtonLink(d.secondaryButtonLink());
        if (d.displayOrder() != null) h.setDisplayOrder(d.displayOrder());
        if (d.active() != null) h.setActive(d.active());
    }

    @Transactional
    public void deleteHeroSlide(Long id) {
        HeroSlide h = heroRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Hero slide not found"));
        softDelete(h);
        heroRepo.save(h);
    }

    @Transactional
    public HeroSlideDto toggleHeroSlide(Long id) {
        HeroSlide h = heroRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Hero slide not found"));
        h.setActive(!Boolean.TRUE.equals(h.getActive()));
        return toDto(heroRepo.save(h));
    }

    private HeroSlideDto toDto(HeroSlide h) {
        return new HeroSlideDto(
                h.getId(), h.getImageUrl(), h.getEyebrow(), h.getTitle(), h.getTitleAccent(), h.getDescription(),
                h.getPrimaryButtonText(), h.getPrimaryButtonLink(),
                h.getSecondaryButtonText(), h.getSecondaryButtonLink(),
                h.getDisplayOrder(), h.getActive());
    }

    // =========================================================================================
    // Testimonials
    // =========================================================================================

    public List<TestimonialDto> listTestimonials() {
        return testimonialRepo.findByIsDeletedFalseOrderByDisplayOrderAsc().stream().map(this::toDto).toList();
    }

    @Transactional
    public TestimonialDto createTestimonial(TestimonialDto d) {
        Testimonial t = new Testimonial();
        applyTestimonial(t, d);
        return toDto(testimonialRepo.save(t));
    }

    @Transactional
    public TestimonialDto updateTestimonial(Long id, TestimonialDto d) {
        Testimonial t = testimonialRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Testimonial not found"));
        applyTestimonial(t, d);
        return toDto(testimonialRepo.save(t));
    }

    private void applyTestimonial(Testimonial t, TestimonialDto d) {
        t.setName(d.name());
        t.setRole(d.role());
        t.setLocation(d.location());
        if (d.rating() != null) t.setRating(d.rating());
        t.setQuote(d.quote());
        if (d.displayOrder() != null) t.setDisplayOrder(d.displayOrder());
        if (d.active() != null) t.setActive(d.active());
    }

    @Transactional
    public void deleteTestimonial(Long id) {
        Testimonial t = testimonialRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Testimonial not found"));
        softDelete(t);
        testimonialRepo.save(t);
    }

    @Transactional
    public TestimonialDto toggleTestimonial(Long id) {
        Testimonial t = testimonialRepo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Testimonial not found"));
        t.setActive(!Boolean.TRUE.equals(t.getActive()));
        return toDto(testimonialRepo.save(t));
    }

    private TestimonialDto toDto(Testimonial t) {
        return new TestimonialDto(
                t.getId(), t.getName(), t.getRole(), t.getLocation(), t.getRating(), t.getQuote(),
                t.getDisplayOrder(), t.getActive());
    }
}
