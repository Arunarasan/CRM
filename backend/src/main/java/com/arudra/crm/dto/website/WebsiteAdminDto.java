package com.arudra.crm.dto.website;

import java.math.BigDecimal;
import java.util.List;

/**
 * Admin (CMS) request/response shapes for the website catalog, served under {@code /api/website/**}.
 * Unlike {@link PublicCatalogDto} (read-only public views), these carry every editable field
 * (active, displayOrder, stock, raw structured JSON fields) so the CRM can fully manage content.
 * The same record is used for both request and response — {@code id} is null on create.
 * JSON-backed columns are exposed here as real structured types; {@code WebsiteAdminService}
 * serializes them to/from the TEXT columns.
 */
public final class WebsiteAdminDto {

    private WebsiteAdminDto() {}

    // ---- shared nested structures ----
    public record SpecRow(String label, String value) {}
    public record ColorVariant(String name, String hex, String image) {}
    public record ProcessStep(String title, String description) {}
    public record FaqItem(String question, String answer) {}
    public record TestimonialBlock(String quote, String name, String role) {}

    public record CategoryDto(
            Long id, String name, String slug, String icon,
            Integer displayOrder, Boolean active) {}

    public record ProductDto(
            Long id, String name, String slug, String sku, Long categoryId,
            String shortDescription, String description, String imageUrl,
            BigDecimal price, BigDecimal discountPrice, Integer stock,
            Double rating, Integer reviewCount, Boolean featured, Boolean active,
            String material, String dimensions,
            List<String> gallery, List<SpecRow> specifications, List<ColorVariant> colors) {}

    public record ServiceDto(
            Long id, String title, String slug, String shortDescription, String imageUrl, String icon,
            String overview, List<String> benefits, List<String> materialsList,
            List<ProcessStep> process, List<FaqItem> faq,
            Integer displayOrder, Boolean active) {}

    public record MaterialDto(
            Long id, String name, String slug, String category, String imageUrl,
            String description, String finish, String color, List<String> applications,
            Integer displayOrder, Boolean active) {}

    public record PortfolioDto(
            Long id, String title, String slug, String category, String location, Integer year,
            String coverImage, String concept, List<String> gallery,
            List<String> materialsList, List<String> servicesList, List<String> highlights,
            TestimonialBlock testimonial, Integer displayOrder, Boolean active) {}

    public record HeroSlideDto(
            Long id, String imageUrl, String eyebrow, String title, String titleAccent, String description,
            String primaryButtonText, String primaryButtonLink,
            String secondaryButtonText, String secondaryButtonLink,
            Integer displayOrder, Boolean active) {}

    public record TestimonialDto(
            Long id, String name, String role, String location, Integer rating, String quote,
            Integer displayOrder, Boolean active) {}

    /** {id, displayOrder} pairs for bulk reorder endpoints. */
    public record ReorderItem(Long id, Integer displayOrder) {}
}
