package com.arudra.crm.service;

import com.arudra.crm.dto.website.PublicCatalogDto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Builds the public website's sitemap.xml at request time from the LIVE, CMS-managed catalog.
 * A hand-maintained static file can never stay in sync with categories/products/services an admin
 * adds in the CRM, so search engines miss them; generating it here means every published page is
 * always discoverable. Served (unauthenticated) via {@code GET /api/public/sitemap.xml} and mapped
 * to the canonical {@code /sitemap.xml} by the edge nginx proxy.
 */
@Service
public class SitemapService {

    private final WebsiteCatalogService catalog;
    private final String base;

    public SitemapService(WebsiteCatalogService catalog,
                          @Value("${app.public-site-url:https://jbdecorcdm.com}") String publicSiteUrl) {
        this.catalog = catalog;
        // Normalise: strip any trailing slash so we append clean paths.
        this.base = publicSiteUrl.replaceAll("/+$", "");
    }

    /** Static marketing routes that always exist, with their crawl hints. */
    private static final String[][] STATIC_ROUTES = {
            {"/", "weekly", "1.0"},
            {"/products", "weekly", "0.9"},
            {"/services", "monthly", "0.9"},
            {"/portfolio", "monthly", "0.9"},
            {"/materials", "monthly", "0.8"},
            {"/design-studio", "monthly", "0.8"},
            {"/consultation", "monthly", "0.8"},
            {"/about", "yearly", "0.7"},
            {"/contact", "yearly", "0.7"},
    };

    public String buildXml() {
        String today = LocalDate.now().toString();
        List<String> urls = new ArrayList<>();

        for (String[] r : STATIC_ROUTES) {
            urls.add(urlEntry(r[0], r[1], r[2], today));
        }

        // Live catalog — categories, product detail pages, services, portfolio, materials.
        try {
            for (CategoryView c : catalog.categories()) {
                if (notBlank(c.slug())) urls.add(urlEntry("/products/" + c.slug(), "monthly", "0.7", today));
            }
            for (ProductView p : catalog.products()) {
                if (notBlank(p.slug()) && notBlank(p.categorySlug()))
                    urls.add(urlEntry("/products/" + p.categorySlug() + "/" + p.slug(), "monthly", "0.6", today));
            }
            for (ServiceView s : catalog.services()) {
                if (notBlank(s.slug())) urls.add(urlEntry("/services/" + s.slug(), "monthly", "0.6", today));
            }
            for (PortfolioView pf : catalog.portfolio()) {
                if (notBlank(pf.slug())) urls.add(urlEntry("/portfolio/" + pf.slug(), "yearly", "0.5", today));
            }
            for (MaterialView m : catalog.materials()) {
                if (notBlank(m.slug())) urls.add(urlEntry("/materials/" + m.slug(), "yearly", "0.4", today));
            }
        } catch (Exception ignored) {
            // If the catalog can't be read, still return a valid sitemap of the static routes.
        }

        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");
        urls.forEach(sb::append);
        sb.append("</urlset>\n");
        return sb.toString();
    }

    private String urlEntry(String path, String changefreq, String priority, String lastmod) {
        return "  <url><loc>" + xml(base + path) + "</loc>"
                + "<lastmod>" + lastmod + "</lastmod>"
                + "<changefreq>" + changefreq + "</changefreq>"
                + "<priority>" + priority + "</priority></url>\n";
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    /** Minimal XML escaping for the ampersand (slugs are otherwise URL-safe). */
    private static String xml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
