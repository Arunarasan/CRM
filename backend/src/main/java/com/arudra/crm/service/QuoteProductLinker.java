package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.BoqItemRepository;
import com.arudra.crm.repository.ProductNameAliasRepository;
import com.arudra.crm.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

/**
 * Links quote lines to inventory products automatically. The quote sheet is free text — an item
 * ("Blackout Curtain — Royal Velvet Maroon") and its material lines carry names, not product ids —
 * so this matches those names against the product catalogue (exact name / code first, then the
 * product's name appearing in the text, then a strong word overlap). Used at quote → project
 * conversion and by the Supply & Install tab's "Load from quote".
 */
@Service
@RequiredArgsConstructor
public class QuoteProductLinker {

    /** One product the quote needs, with where it came from. matched=false means no product was found. */
    public record Line(Long boqItemId, String source, Product product, BigDecimal quantity, String unit, boolean matched) {}

    private static final Set<String> STOP = Set.of(
            "and", "the", "for", "with", "nos", "pcs", "per", "set", "sqft", "rft", "mtr", "meter", "meters",
            "room", "type", "size", "new", "item", "work", "supply", "install", "installation", "fixing");
    private static final double MIN_OVERLAP = 0.6;

    private final ProductRepository productRepository;
    private final BoqItemRepository boqItemRepository;
    private final ProductNameAliasRepository aliasRepository;

    /** Remembers a hand-made link so this name matches the product automatically from now on. */
    @Transactional
    public void remember(String name, Product product) {
        String key = Catalogue.norm(name);
        if (key.isEmpty() || product == null) return;
        ProductNameAlias alias = aliasRepository.findByAlias(key).orElseGet(ProductNameAlias::new);
        alias.setAlias(key);
        alias.setProduct(product);
        aliasRepository.save(alias);
    }

    /**
     * Resolves the products a quotation needs. Material lines already tied to a product are skipped
     * when {@code skipLinkedMaterials} is true (conversion handles those itself, with stock reservation).
     */
    @Transactional(readOnly = true)
    public List<Line> resolve(List<QuotationItem> items, boolean skipLinkedMaterials) {
        Catalogue catalogue = new Catalogue(productRepository.findAll().stream()
                .filter(p -> p.getStatus() == null || "ACTIVE".equalsIgnoreCase(p.getStatus()))
                .toList());
        aliasRepository.findAll().forEach(a -> catalogue.alias(a.getAlias(), a.getProduct()));
        List<Line> out = new ArrayList<>();
        for (QuotationItem q : items) {
            BoqItem boqItem = q.getBoqItemId() != null ? boqItemRepository.findById(q.getBoqItemId()).orElse(null) : null;
            List<BoqItemMaterial> materials = boqItem != null ? boqItem.getMaterials() : List.of();
            boolean anyMaterialLine = false;
            for (BoqItemMaterial m : materials) {
                BigDecimal qty = m.supplyQuantity();
                if (qty == null || qty.signum() <= 0) continue;
                if (m.getProduct() != null) {
                    anyMaterialLine = true;
                    if (!skipLinkedMaterials) out.add(new Line(q.getBoqItemId(), m.getMaterialName(), m.getProduct(), qty, m.getUnit(), true));
                    continue;
                }
                if (m.getMaterialName() == null || m.getMaterialName().isBlank()) continue;
                anyMaterialLine = true;
                Product p = catalogue.match(m.getMaterialName(), null);
                out.add(new Line(q.getBoqItemId(), m.getMaterialName().trim(), p, qty, m.getUnit() != null ? m.getUnit() : q.getUnit(), p != null));
            }
            if (anyMaterialLine) continue;

            // Picked from the catalogue on the sheet: no guessing needed.
            Long pickedId = q.getProductId() != null ? q.getProductId() : (boqItem != null ? boqItem.getProductId() : null);
            Product picked = pickedId != null ? productRepository.findById(pickedId).orElse(null) : null;
            BigDecimal pickedQty = q.getQuantity() != null ? q.getQuantity() : (boqItem != null ? boqItem.getQuantity() : null);
            if (picked != null && pickedQty != null && pickedQty.signum() > 0) {
                out.add(new Line(q.getBoqItemId(), q.getItemName(), picked, pickedQty, q.getUnit(), true));
                continue;
            }

            // No material breakdown: the quote line itself is the product (curtains, blinds, wallpaper…).
            BigDecimal qty = q.getQuantity() != null ? q.getQuantity() : (boqItem != null ? boqItem.getQuantity() : null);
            if (qty == null || qty.signum() <= 0) continue;
            String name = q.getItemName() != null ? q.getItemName() : (boqItem != null ? boqItem.getItemName() : null);
            if (name == null || name.isBlank()) continue;
            String extra = String.join(" ", Objects.toString(q.getDescription(), ""), Objects.toString(q.getSpecification(), ""),
                    Objects.toString(q.getBrand(), ""), Objects.toString(q.getColor(), ""));
            Product p = catalogue.match(name, extra);
            out.add(new Line(q.getBoqItemId(), name.trim(), p, qty, q.getUnit(), p != null));
        }
        return out;
    }

    /** In-memory catalogue index, built once per resolve call. */
    private static final class Catalogue {
        private final List<Product> products;
        private final Map<String, Product> byExact = new HashMap<>();
        private final Map<String, Product> byAlias = new HashMap<>();

        void alias(String key, Product p) {
            if (p != null) byAlias.put(key, p);
        }

        Catalogue(List<Product> products) {
            this.products = products;
            for (Product p : products) {
                for (String key : new String[]{p.getName(), p.getSku(), p.getMaterialCode()}) {
                    if (key != null && !key.isBlank()) byExact.putIfAbsent(norm(key), p);
                }
            }
        }

        Product match(String name, String extra) {
            String n = norm(name);
            Product taught = byAlias.get(n);
            if (taught != null) return taught;
            Product exact = byExact.get(n);
            if (exact != null) return exact;

            // A product's full name (or code) written inside the quote text — longest wins.
            String haystack = " " + n + " " + norm(Objects.toString(extra, "")) + " ";
            Product best = null;
            int bestLen = 0;
            for (Product p : products) {
                for (String key : new String[]{p.getName(), p.getSku(), p.getMaterialCode()}) {
                    if (key == null) continue;
                    String k = norm(key);
                    if (k.length() >= 4 && k.length() > bestLen && haystack.contains(" " + k + " ")) {
                        best = p;
                        bestLen = k.length();
                    }
                }
            }
            if (best != null) return best;

            // Strong word overlap with the item name: most of the product's words must appear.
            Set<String> words = tokens(n + " " + norm(Objects.toString(extra, "")));
            double bestScore = 0;
            int bestHits = 0;
            for (Product p : products) {
                Set<String> pw = tokens(norm(Objects.toString(p.getName(), "")));
                if (pw.size() < 2) continue; // one-word product names are too vague to guess from
                int hits = (int) pw.stream().filter(words::contains).count();
                double score = (double) hits / pw.size();
                if (score >= MIN_OVERLAP && (score > bestScore || (score == bestScore && hits > bestHits))) {
                    best = p;
                    bestScore = score;
                    bestHits = hits;
                }
            }
            return best;
        }

        static String norm(String s) {
            return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
        }

        private static Set<String> tokens(String s) {
            Set<String> out = new HashSet<>();
            for (String t : s.split(" ")) {
                if (t.length() >= 3 && !STOP.contains(t)) out.add(t.endsWith("s") && t.length() > 4 ? t.substring(0, t.length() - 1) : t);
            }
            return out;
        }
    }
}
