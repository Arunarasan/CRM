package com.arudra.crm.dto.website;

import java.math.BigDecimal;
import java.util.List;

/**
 * Public, non-sensitive views of the website catalog returned by {@code /api/public/**}.
 * Field names mirror the website's TypeScript types so the frontend can swap from local seed
 * data to the API with no shape changes. JSON-backed fields (process, faq, gallery, specifications,
 * testimonial) are parsed to Object so they serialize as real arrays/objects, not strings.
 */
public final class PublicCatalogDto {

    private PublicCatalogDto() {}

    public record CategoryView(Long id, String name, String slug, String icon) {}

    public record ProductView(
            Long id, String name, String slug, String sku, String categorySlug,
            String shortDescription, String description, String image,
            BigDecimal price, BigDecimal discountPrice,
            Double rating, Integer reviewCount, Boolean featured, Boolean inStock,
            String material, String dimensions,
            List<String> gallery, Object specifications) {}

    public record ServiceView(
            Long id, String title, String slug, String shortDescription, String image, String icon,
            String overview, List<String> benefits, List<String> materials,
            Object process, Object faq) {}

    public record MaterialView(
            Long id, String name, String slug, String category, String image,
            String description, String finish, String color, List<String> applications) {}

    public record PortfolioView(
            Long id, String title, String slug, String category, String location, Integer year,
            String image, String concept, List<String> gallery,
            List<String> materials, List<String> services, List<String> highlights,
            Object testimonial) {}

    public record HeroSlideView(
            Long id, String image, String eyebrow, String title, String titleAccent, String description,
            String primaryButtonText, String primaryButtonLink,
            String secondaryButtonText, String secondaryButtonLink) {}

    public record TestimonialView(
            Long id, String name, String role, String location, Integer rating, String quote) {}
}
