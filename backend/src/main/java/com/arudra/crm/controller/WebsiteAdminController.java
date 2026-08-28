package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.dto.website.WebsiteAdminDto.*;
import com.arudra.crm.service.WebsiteAdminService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Website / CMS management API. Authenticated CRM-side editing of the public catalog that
 * {@code /api/public/**} serves. Guarded by WEBSITE_READ / WEBSITE_WRITE (or ROLE_ADMIN).
 * Writes land in the same tables the public site reads, so edits are live on the next fetch.
 */
@RestController
@RequestMapping("/api/website")
public class WebsiteAdminController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WEBSITE_WRITE')";

    private final WebsiteAdminService svc;

    public WebsiteAdminController(WebsiteAdminService svc) {
        this.svc = svc;
    }

    // ---- Categories ----
    @GetMapping("/categories") @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<CategoryDto>>> categories() {
        return ok(svc.listCategories());
    }
    @PostMapping("/categories") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<CategoryDto>> createCategory(@RequestBody CategoryDto d) {
        return saved(svc.createCategory(d));
    }
    @PutMapping("/categories/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<CategoryDto>> updateCategory(@PathVariable Long id, @RequestBody CategoryDto d) {
        return saved(svc.updateCategory(id, d));
    }
    @DeleteMapping("/categories/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> deleteCategory(@PathVariable Long id) {
        svc.deleteCategory(id); return deleted();
    }
    @PatchMapping("/categories/{id}/toggle") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<CategoryDto>> toggleCategory(@PathVariable Long id) {
        return saved(svc.toggleCategory(id));
    }

    // ---- Products ----
    @GetMapping("/products") @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<ProductDto>>> products() {
        return ok(svc.listProducts());
    }
    @PostMapping("/products") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProductDto>> createProduct(@RequestBody ProductDto d) {
        return saved(svc.createProduct(d));
    }
    @PutMapping("/products/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProductDto>> updateProduct(@PathVariable Long id, @RequestBody ProductDto d) {
        return saved(svc.updateProduct(id, d));
    }
    @DeleteMapping("/products/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> deleteProduct(@PathVariable Long id) {
        svc.deleteProduct(id); return deleted();
    }
    @PatchMapping("/products/{id}/toggle") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ProductDto>> toggleProduct(@PathVariable Long id) {
        return saved(svc.toggleProduct(id));
    }

    // ---- Services ----
    @GetMapping("/services") @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<ServiceDto>>> services() {
        return ok(svc.listServices());
    }
    @PostMapping("/services") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ServiceDto>> createService(@RequestBody ServiceDto d) {
        return saved(svc.createService(d));
    }
    @PutMapping("/services/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ServiceDto>> updateService(@PathVariable Long id, @RequestBody ServiceDto d) {
        return saved(svc.updateService(id, d));
    }
    @DeleteMapping("/services/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> deleteService(@PathVariable Long id) {
        svc.deleteService(id); return deleted();
    }
    @PatchMapping("/services/{id}/toggle") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<ServiceDto>> toggleService(@PathVariable Long id) {
        return saved(svc.toggleService(id));
    }

    // ---- Materials ----
    @GetMapping("/materials") @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<MaterialDto>>> materials() {
        return ok(svc.listMaterials());
    }
    @PostMapping("/materials") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<MaterialDto>> createMaterial(@RequestBody MaterialDto d) {
        return saved(svc.createMaterial(d));
    }
    @PutMapping("/materials/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<MaterialDto>> updateMaterial(@PathVariable Long id, @RequestBody MaterialDto d) {
        return saved(svc.updateMaterial(id, d));
    }
    @DeleteMapping("/materials/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> deleteMaterial(@PathVariable Long id) {
        svc.deleteMaterial(id); return deleted();
    }
    @PatchMapping("/materials/{id}/toggle") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<MaterialDto>> toggleMaterial(@PathVariable Long id) {
        return saved(svc.toggleMaterial(id));
    }

    // ---- Portfolio ----
    @GetMapping("/portfolio") @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<PortfolioDto>>> portfolio() {
        return ok(svc.listPortfolio());
    }
    @PostMapping("/portfolio") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<PortfolioDto>> createPortfolio(@RequestBody PortfolioDto d) {
        return saved(svc.createPortfolio(d));
    }
    @PutMapping("/portfolio/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<PortfolioDto>> updatePortfolio(@PathVariable Long id, @RequestBody PortfolioDto d) {
        return saved(svc.updatePortfolio(id, d));
    }
    @DeleteMapping("/portfolio/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> deletePortfolio(@PathVariable Long id) {
        svc.deletePortfolio(id); return deleted();
    }
    @PatchMapping("/portfolio/{id}/toggle") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<PortfolioDto>> togglePortfolio(@PathVariable Long id) {
        return saved(svc.togglePortfolio(id));
    }

    // ---- Hero slides ----
    @GetMapping("/hero-slides") @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<HeroSlideDto>>> heroSlides() {
        return ok(svc.listHeroSlides());
    }
    @PostMapping("/hero-slides") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<HeroSlideDto>> createHeroSlide(@RequestBody HeroSlideDto d) {
        return saved(svc.createHeroSlide(d));
    }
    @PutMapping("/hero-slides/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<HeroSlideDto>> updateHeroSlide(@PathVariable Long id, @RequestBody HeroSlideDto d) {
        return saved(svc.updateHeroSlide(id, d));
    }
    @DeleteMapping("/hero-slides/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> deleteHeroSlide(@PathVariable Long id) {
        svc.deleteHeroSlide(id); return deleted();
    }
    @PatchMapping("/hero-slides/{id}/toggle") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<HeroSlideDto>> toggleHeroSlide(@PathVariable Long id) {
        return saved(svc.toggleHeroSlide(id));
    }

    // ---- Testimonials ----
    @GetMapping("/testimonials") @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<TestimonialDto>>> testimonials() {
        return ok(svc.listTestimonials());
    }
    @PostMapping("/testimonials") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<TestimonialDto>> createTestimonial(@RequestBody TestimonialDto d) {
        return saved(svc.createTestimonial(d));
    }
    @PutMapping("/testimonials/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<TestimonialDto>> updateTestimonial(@PathVariable Long id, @RequestBody TestimonialDto d) {
        return saved(svc.updateTestimonial(id, d));
    }
    @DeleteMapping("/testimonials/{id}") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<Void>> deleteTestimonial(@PathVariable Long id) {
        svc.deleteTestimonial(id); return deleted();
    }
    @PatchMapping("/testimonials/{id}/toggle") @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<TestimonialDto>> toggleTestimonial(@PathVariable Long id) {
        return saved(svc.toggleTestimonial(id));
    }

    // ---- response helpers ----
    private <T> ResponseEntity<ApiResponse<T>> ok(T data) {
        return ResponseEntity.ok(ApiResponse.success(data));
    }
    private <T> ResponseEntity<ApiResponse<T>> saved(T data) {
        return ResponseEntity.ok(ApiResponse.success(data, "Saved"));
    }
    private ResponseEntity<ApiResponse<Void>> deleted() {
        return ResponseEntity.ok(ApiResponse.success(null, "Deleted"));
    }
}
