package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.dto.website.CheckoutRequest;
import com.arudra.crm.dto.website.PublicCatalogDto.*;
import com.arudra.crm.dto.website.WebsiteLeadRequest;
import com.arudra.crm.dto.website.SiteContentDto.ContentBlockDto;
import com.arudra.crm.service.WebsiteCatalogService;
import com.arudra.crm.service.WebsiteContentService;
import com.arudra.crm.service.WebsiteLeadService;
import com.arudra.crm.service.WebsiteOrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Unauthenticated public website API (permitted in SecurityConfig). Serves the read-only catalog
 * that powers the marketing site, and accepts website enquiries/consultations which become CRM leads.
 * Nothing here exposes internal CRM data.
 */
@RestController
@RequestMapping("/api/public")
@CrossOrigin(origins = "*")
public class PublicWebsiteController {

    private final WebsiteCatalogService catalog;
    private final WebsiteLeadService leadService;
    private final WebsiteOrderService orderService;
    private final WebsiteContentService contentService;

    public PublicWebsiteController(WebsiteCatalogService catalog, WebsiteLeadService leadService,
                                   WebsiteOrderService orderService, WebsiteContentService contentService) {
        this.catalog = catalog;
        this.leadService = leadService;
        this.orderService = orderService;
        this.contentService = contentService;
    }

    // ---- Catalog ----
    @GetMapping("/hero-slides")
    public ResponseEntity<ApiResponse<List<HeroSlideView>>> heroSlides() {
        return ResponseEntity.ok(ApiResponse.success(catalog.heroSlides()));
    }

    @GetMapping("/categories")
    public ResponseEntity<ApiResponse<List<CategoryView>>> categories() {
        return ResponseEntity.ok(ApiResponse.success(catalog.categories()));
    }

    @GetMapping("/products")
    public ResponseEntity<ApiResponse<List<ProductView>>> products(
            @RequestParam(required = false, defaultValue = "false") boolean featured) {
        return ResponseEntity.ok(ApiResponse.success(featured ? catalog.featuredProducts() : catalog.products()));
    }

    @GetMapping("/products/{slug}")
    public ResponseEntity<ApiResponse<ProductView>> product(@PathVariable String slug) {
        ProductView p = catalog.product(slug);
        return p == null ? ResponseEntity.status(404).body(ApiResponse.error("Product not found"))
                : ResponseEntity.ok(ApiResponse.success(p));
    }

    @GetMapping("/services")
    public ResponseEntity<ApiResponse<List<ServiceView>>> services() {
        return ResponseEntity.ok(ApiResponse.success(catalog.services()));
    }

    @GetMapping("/services/{slug}")
    public ResponseEntity<ApiResponse<ServiceView>> service(@PathVariable String slug) {
        ServiceView s = catalog.service(slug);
        return s == null ? ResponseEntity.status(404).body(ApiResponse.error("Service not found"))
                : ResponseEntity.ok(ApiResponse.success(s));
    }

    @GetMapping("/portfolio")
    public ResponseEntity<ApiResponse<List<PortfolioView>>> portfolio() {
        return ResponseEntity.ok(ApiResponse.success(catalog.portfolio()));
    }

    @GetMapping("/portfolio/{slug}")
    public ResponseEntity<ApiResponse<PortfolioView>> portfolioProject(@PathVariable String slug) {
        PortfolioView p = catalog.portfolioProject(slug);
        return p == null ? ResponseEntity.status(404).body(ApiResponse.error("Project not found"))
                : ResponseEntity.ok(ApiResponse.success(p));
    }

    @GetMapping("/materials")
    public ResponseEntity<ApiResponse<List<MaterialView>>> materials() {
        return ResponseEntity.ok(ApiResponse.success(catalog.materials()));
    }

    @GetMapping("/materials/{slug}")
    public ResponseEntity<ApiResponse<MaterialView>> material(@PathVariable String slug) {
        MaterialView m = catalog.material(slug);
        return m == null ? ResponseEntity.status(404).body(ApiResponse.error("Material not found"))
                : ResponseEntity.ok(ApiResponse.success(m));
    }

    @GetMapping("/testimonials")
    public ResponseEntity<ApiResponse<List<TestimonialView>>> testimonials() {
        return ResponseEntity.ok(ApiResponse.success(catalog.testimonials()));
    }

    // ---- Enquiries → CRM leads ----
    @PostMapping("/leads")
    public ResponseEntity<ApiResponse<Void>> contact(@RequestBody WebsiteLeadRequest req) {
        leadService.createFromWebsite(req, "Website Contact");
        return ResponseEntity.ok(ApiResponse.success(null,
                "Thank you — your enquiry has reached our team."));
    }

    @PostMapping("/consultations")
    public ResponseEntity<ApiResponse<Void>> consultation(@RequestBody WebsiteLeadRequest req) {
        leadService.createFromWebsite(req, "Website Consultation");
        return ResponseEntity.ok(ApiResponse.success(null,
                "Thank you — our design team will be in touch shortly."));
    }

    // ---- Shop checkout → CRM order ----
    @PostMapping("/orders")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkout(@RequestBody CheckoutRequest req) {
        return ResponseEntity.ok(ApiResponse.success(orderService.placeOrder(req),
                "Thank you — your order has been received."));
    }

    // ---- CMS-managed settings + page content ----
    @GetMapping("/settings")
    public ResponseEntity<ApiResponse<Map<String, String>>> settings() {
        return ResponseEntity.ok(ApiResponse.success(contentService.publicSettings()));
    }

    @GetMapping("/content/{page}")
    public ResponseEntity<ApiResponse<List<ContentBlockDto>>> content(@PathVariable String page) {
        return ResponseEntity.ok(ApiResponse.success(contentService.publicContent(page)));
    }
}
