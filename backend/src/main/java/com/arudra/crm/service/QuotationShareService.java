package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.QuotationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

/**
 * The customer's quotation link ({@code /q/{token}}) sent by "Share Quote" with the PDF.
 * <p>
 * The token is the only credential and resolves exactly one quotation. The public view is a curated
 * whitelist — what the printed quotation shows (items, prices, totals, terms) and nothing internal
 * (costs, materials/labour breakdown, notes, other quotations or any CRM data). "Accept" on that page
 * only records the customer's acceptance and alerts the team; the approval itself (which locks the
 * sheet and reserves stock) stays a staff action in the CRM.
 */
@Service
public class QuotationShareService {

    /** Quotation statuses that are finished — the link still opens but can't be accepted. */
    private static final Set<String> CLOSED = Set.of("REJECTED", "CANCELLED", "EXPIRED", "LOST");

    private final QuotationRepository quotationRepository;
    private final NotificationService notificationService;

    public QuotationShareService(QuotationRepository quotationRepository, NotificationService notificationService) {
        this.quotationRepository = quotationRepository;
        this.notificationService = notificationService;
    }

    // ---------------- Staff (authenticated) ----------------

    /** Make sure the quotation has a working link; remembers the PDF sent with it. */
    @Transactional
    public Map<String, Object> share(Long quotationId, String pdfUrl) {
        Quotation q = find(quotationId);
        if (q.getShareToken() == null || q.getShareToken().isBlank()) q.setShareToken(newToken());
        q.setShareEnabled(true);
        if (pdfUrl != null && !pdfUrl.isBlank()) q.setSharePdfUrl(pdfUrl.trim());
        q.setSharedAt(LocalDateTime.now());
        return linkState(quotationRepository.save(q));
    }

    /** A new token: the old link stops working. */
    @Transactional
    public Map<String, Object> regenerate(Long quotationId) {
        Quotation q = find(quotationId);
        q.setShareToken(newToken());
        q.setShareEnabled(true);
        return linkState(quotationRepository.save(q));
    }

    @Transactional
    public Map<String, Object> setEnabled(Long quotationId, boolean enabled) {
        Quotation q = find(quotationId);
        if (enabled && (q.getShareToken() == null || q.getShareToken().isBlank())) q.setShareToken(newToken());
        q.setShareEnabled(enabled);
        return linkState(quotationRepository.save(q));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> state(Long quotationId) {
        return linkState(find(quotationId));
    }

    private Quotation find(Long id) {
        return quotationRepository.findById(id)
                .filter(q -> !Boolean.TRUE.equals(q.getIsDeleted()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Quotation not found."));
    }

    private static Map<String, Object> linkState(Quotation q) {
        return map("shareToken", q.getShareToken(), "shareEnabled", q.isShareEnabled(),
                "sharePdfUrl", q.getSharePdfUrl(), "sharedAt", q.getSharedAt(),
                "customerAcceptedAt", q.getCustomerAcceptedAt(), "customerAcceptedName", q.getCustomerAcceptedName());
    }

    private static String newToken() {
        // 2 UUIDs = 256 random bits; unguessable and URL-safe.
        return (UUID.randomUUID().toString() + UUID.randomUUID().toString()).replace("-", "");
    }

    // ---------------- Public (token only) ----------------

    private Quotation resolve(String token) {
        if (token == null || token.length() < 20) throw notFound();
        return quotationRepository.findByShareToken(token)
                .filter(q -> !Boolean.TRUE.equals(q.getIsDeleted()) && q.isShareEnabled())
                .orElseThrow(QuotationShareService::notFound);
    }

    private static ResponseStatusException notFound() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "This quotation link is not valid or has been turned off.");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> view(String token) {
        Quotation q = resolve(token);

        List<QuotationItem> items = new ArrayList<>(q.getItems() == null ? List.of() : q.getItems());
        items.removeIf(i -> "REJECTED".equalsIgnoreCase(i.getStatus()));
        items.sort(Comparator.comparing((QuotationItem i) -> nzi(i.getFloorOrder()))
                .thenComparing(i -> nzi(i.getRoomOrder()))
                .thenComparing(i -> nzi(i.getItemOrder()))
                .thenComparing(i -> i.getId() == null ? 0L : i.getId()));

        BigDecimal gross = BigDecimal.ZERO, lineDisc = BigDecimal.ZERO, net = BigDecimal.ZERO;
        List<Map<String, Object>> lines = new ArrayList<>();
        for (QuotationItem i : items) {
            BigDecimal g = nz(i.getRate()).multiply(nz(i.getQuantity()));
            BigDecimal d = nz(i.getDiscountPercentage()).signum() > 0
                    ? g.multiply(nz(i.getDiscountPercentage())).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                    : nz(i.getDiscountAmount()).min(g);
            BigDecimal total = nz(i.getTotalAmount());
            gross = gross.add(g);
            lineDisc = lineDisc.add(d);
            net = net.add(total);
            String place = blank(i.getLocation()) ? i.getRoomName() : i.getLocation();
            lines.add(map(
                    "category", blank(i.getCategory()) ? "Others" : i.getCategory().trim(),
                    "name", i.getItemName(),
                    "description", i.getDescription(),
                    "color", i.getColor(),
                    "location", place,
                    "imageUrl", i.getImageUrl(),
                    "unit", i.getUnit(),
                    "quantity", i.getQuantity(),
                    "rate", i.getRate(),
                    "discountPercent", nz(i.getDiscountPercentage()).signum() > 0 ? i.getDiscountPercentage() : null,
                    "discount", d,
                    "amount", total));
        }

        List<Map<String, Object>> charges = new ArrayList<>();
        BigDecimal labour = (q.getLabours() == null ? List.<QuotationLabour>of() : q.getLabours()).stream()
                .map(l -> nz(l.getAmount())).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (labour.signum() > 0) charges.add(map("label", "Labour", "amount", labour));
        if (q.getAdditionalCharges() != null) {
            for (QuotationAdditionalCharge c : q.getAdditionalCharges()) {
                if (nz(c.getAmount()).signum() <= 0) continue;
                charges.add(map("label", blank(c.getChargeType()) ? "Charges" : c.getChargeType(),
                        "note", c.getDescription(), "amount", c.getAmount()));
            }
        }
        BigDecimal gstPercent = q.getTaxes() == null ? null : q.getTaxes().stream()
                .map(t -> nz(t.getPercentage())).reduce(BigDecimal.ZERO, BigDecimal::add);

        List<String> terms = new ArrayList<>();
        if (q.getTerms() != null) q.getTerms().forEach(t -> { if (!blank(t.getContent())) terms.add(t.getContent().trim()); });
        if (terms.isEmpty() && !blank(q.getTermsAndConditions())) {
            for (String line : q.getTermsAndConditions().split("\\r?\\n")) if (!line.isBlank()) terms.add(line.trim());
        }

        Customer c = q.getCustomer();
        Lead lead = q.getLead();
        String customerName = c != null && !blank(c.getName()) ? c.getName() : lead != null ? lead.getName() : null;
        String city = lead != null ? lead.getCity() : null;

        return map(
                "quotationNumber", q.getQuotationNumber(),
                "quotationDate", q.getQuotationDate(),
                "expiryDate", q.getExpiryDate(),
                "state", publicState(q),
                "customerName", customerName,
                "city", city,
                "preparedBy", q.getPreparedBy() != null ? q.getPreparedBy().getName() : null,
                "items", lines,
                "charges", charges,
                "productsTotal", gross,
                "lineDiscount", lineDisc,
                "productsNet", net,
                "discount", nz(q.getDiscount()),
                "gst", nz(q.getGst()),
                "gstPercent", gstPercent != null && gstPercent.signum() > 0 ? gstPercent : null,
                "grandTotal", nz(q.getGrandTotal()),
                "terms", terms,
                "pdfUrl", q.getSharePdfUrl(),
                "acceptedAt", q.getCustomerAcceptedAt(),
                "acceptedName", q.getCustomerAcceptedName());
    }

    /** OPEN (can accept) · ACCEPTED (customer pressed accept) · APPROVED · REPLACED (newer quote) · CLOSED. */
    private static String publicState(Quotation q) {
        String s = q.getStatus() == null ? "" : q.getStatus().toUpperCase(Locale.ROOT);
        if ("APPROVED".equals(s) || "CONVERTED".equals(s)) return "APPROVED";
        if ("REVISED".equals(s) || Boolean.FALSE.equals(q.getIsLatestVersion())) return "REPLACED";
        if (CLOSED.contains(s)) return "CLOSED";
        return q.getCustomerAcceptedAt() != null ? "ACCEPTED" : "OPEN";
    }

    /** Customer pressed "Accept" — recorded once, and the team is told to confirm it. */
    @Transactional
    public Map<String, Object> accept(String token, Map<String, Object> body) {
        Quotation q = resolve(token);
        String state = publicState(q);
        if ("ACCEPTED".equals(state) || "APPROVED".equals(state)) return view(token);
        if (!"OPEN".equals(state)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This quotation can no longer be accepted online — please contact us.");
        }
        String name = trim(body.get("name"), 150);
        if (blank(name)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Please enter your name.");
        q.setCustomerAcceptedAt(LocalDateTime.now());
        q.setCustomerAcceptedName(name);
        q.setCustomerAcceptNote(trim(body.get("note"), 2000));
        quotationRepository.save(q);

        String title = "Quotation " + q.getQuotationNumber() + " accepted online";
        String msg = name + " accepted " + q.getQuotationNumber() + " (₹"
                + nz(q.getGrandTotal()).setScale(0, RoundingMode.HALF_UP).toPlainString()
                + ") from the shared link — confirm the customer approval in the CRM.";
        Lead lead = q.getLead();
        String url = lead != null ? "/leads/" + lead.getId() + "?tab=journey" : "/quotations";
        Long owner = lead == null ? null
                : lead.getAssignedSalesExecutive() != null ? lead.getAssignedSalesExecutive().getId()
                : lead.getLeadOwner() != null ? lead.getLeadOwner().getId() : null;
        notificationService.dispatchToAdmins(title, msg, "QUOTATION", url, owner);
        if (owner != null) notificationService.dispatch(title, msg, "QUOTATION", owner, url);
        return view(token);
    }

    // ---------------- helpers ----------------

    private static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }
    private static int nzi(Integer v) { return v == null ? 0 : v; }
    private static boolean blank(String s) { return s == null || s.isBlank(); }

    private static String trim(Object o, int max) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.length() > max ? s.substring(0, max) : s;
    }
}
