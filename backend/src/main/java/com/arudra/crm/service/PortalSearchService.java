package com.arudra.crm.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * One search box for the employee portal: a customer's phone / name / code, a lead, a project, or a
 * parcel (supplier shipping ID or customer order code). Returns the matching records together with
 * their open tasks and pending (unpaid) invoice amounts, so everything shows on a single page.
 *
 * Read-only, plain SQL — no lazy entities, so the result is always safely serialisable.
 */
@Service
public class PortalSearchService {

    private static final Logger log = LoggerFactory.getLogger(PortalSearchService.class);
    private static final int LIMIT = 8;
    /** Invoice states that still carry money owed. */
    private static final String OWING = "('GENERATED','SENT','PARTIAL','OVERDUE')";

    private final JdbcTemplate jdbc;

    public PortalSearchService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> search(String raw) {
        String q = raw == null ? "" : raw.trim();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("query", q);
        if (q.length() < 2) {
            out.put("customers", List.of());
            out.put("leads", List.of());
            out.put("projects", List.of());
            out.put("parcels", List.of());
            return out;
        }
        String like = "%" + q.toLowerCase() + "%";
        String digits = q.replaceAll("\\D", "");
        String digitsLike = digits.length() >= 3 ? "%" + digits + "%" : "\u0000never";

        out.put("customers", section("customers", () -> customers(like, digitsLike)));
        out.put("leads", section("leads", () -> leads(like, digitsLike)));
        out.put("projects", section("projects", () -> projects(like)));
        out.put("parcels", section("parcels", () -> parcels(like)));
        return out;
    }

    /** One broken section (bad row, schema drift) must not fail the whole search — log it and return what we have. */
    private List<Map<String, Object>> section(String name, Supplier<List<Map<String, Object>>> load) {
        try {
            return load.get();
        } catch (RuntimeException e) {
            log.error("Portal search section '{}' failed", name, e);
            return List.of();
        }
    }

    // --- customers -----------------------------------------------------------------------

    private List<Map<String, Object>> customers(String like, String digitsLike) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT c.id, c.name, c.phone, c.alternate_phone AS alternatePhone, c.customer_code AS code, "
                        + "c.company_name AS company, c.site_address AS address, c.customer_segment AS segment "
                        + "FROM customers c WHERE c.is_deleted = 0 AND ("
                        + " LOWER(c.name) LIKE ? OR LOWER(IFNULL(c.company_name,'')) LIKE ? OR LOWER(IFNULL(c.customer_code,'')) LIKE ?"
                        + " OR REPLACE(REPLACE(IFNULL(c.phone,''),' ',''),'-','') LIKE ?"
                        + " OR REPLACE(REPLACE(IFNULL(c.alternate_phone,''),' ',''),'-','') LIKE ?"
                        + " OR REPLACE(REPLACE(IFNULL(c.whatsapp_number,''),' ',''),'-','') LIKE ?)"
                        + " ORDER BY c.name LIMIT " + LIMIT,
                like, like, like, digitsLike, digitsLike, digitsLike);
        for (Map<String, Object> c : rows) {
            Long id = ((Number) c.get("id")).longValue();
            c.put("pendingAmount", jdbc.queryForObject(
                    "SELECT COALESCE(SUM(COALESCE(balance_due, total_amount)),0) FROM invoices "
                            + "WHERE customer_id = ? AND is_deleted = 0 AND status IN " + OWING,
                    java.math.BigDecimal.class, id));
            c.put("invoices", jdbc.queryForList(
                    "SELECT id, invoice_number AS number, status, due_date AS dueDate, total_amount AS total, "
                            + "COALESCE(balance_due, total_amount) AS balance FROM invoices "
                            + "WHERE customer_id = ? AND is_deleted = 0 AND status IN " + OWING
                            + " ORDER BY due_date IS NULL, due_date LIMIT 5", id));
            c.put("projects", jdbc.queryForList(
                    "SELECT id, project_code AS code, project_name AS name, status FROM projects "
                            + "WHERE customer_id = ? AND is_deleted = 0 ORDER BY id DESC LIMIT 5", id));
            c.put("tasks", jdbc.queryForList(
                    "SELECT t.id, t.task_name AS taskName, t.status, t.due_date AS dueDate, t.progress, p.project_name AS projectName "
                            + "FROM tasks t LEFT JOIN projects p ON p.id = t.project_id "
                            + "WHERE t.is_deleted = 0 AND t.status NOT IN ('COMPLETED','CANCELLED') "
                            + "AND (t.customer_id = ? OR p.customer_id = ?) ORDER BY t.due_date IS NULL, t.due_date LIMIT 8", id, id));
        }
        return rows;
    }

    // --- leads (customers not yet converted) -----------------------------------------------

    private List<Map<String, Object>> leads(String like, String digitsLike) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT l.id, l.lead_number AS code, l.name, l.mobile_number AS phone, l.status, l.stage, l.rating, "
                        + "l.site_address AS address FROM leads l WHERE l.is_deleted = 0 AND ("
                        + " LOWER(l.name) LIKE ? OR LOWER(IFNULL(l.lead_number,'')) LIKE ?"
                        + " OR REPLACE(REPLACE(IFNULL(l.mobile_number,''),' ',''),'-','') LIKE ?"
                        + " OR REPLACE(REPLACE(IFNULL(l.alternate_mobile,''),' ',''),'-','') LIKE ?)"
                        + " ORDER BY l.id DESC LIMIT " + LIMIT,
                like, like, digitsLike, digitsLike);
        for (Map<String, Object> l : rows) {
            Long id = ((Number) l.get("id")).longValue();
            l.put("tasks", jdbc.queryForList(
                    "SELECT t.id, t.task_name AS taskName, t.status, t.due_date AS dueDate, t.progress "
                            + "FROM tasks t WHERE t.is_deleted = 0 AND t.lead_id = ? "
                            + "AND t.status NOT IN ('COMPLETED','CANCELLED') ORDER BY t.due_date IS NULL, t.due_date LIMIT 6", id));
        }
        return rows;
    }

    // --- projects --------------------------------------------------------------------------

    private List<Map<String, Object>> projects(String like) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id, p.project_code AS code, p.project_name AS name, p.status, p.property_address AS address, "
                        + "p.expected_completion_date AS dueDate, c.name AS customerName, c.phone AS customerPhone "
                        + "FROM projects p LEFT JOIN customers c ON c.id = p.customer_id "
                        + "WHERE p.is_deleted = 0 AND (LOWER(p.project_name) LIKE ? OR LOWER(IFNULL(p.project_code,'')) LIKE ?) "
                        + "ORDER BY p.id DESC LIMIT " + LIMIT, like, like);
        List<Map<String, Object>> withDetails = new ArrayList<>();
        for (Map<String, Object> p : rows) {
            Long id = ((Number) p.get("id")).longValue();
            p.put("pendingAmount", jdbc.queryForObject(
                    "SELECT COALESCE(SUM(COALESCE(balance_due, total_amount)),0) FROM invoices "
                            + "WHERE project_id = ? AND is_deleted = 0 AND status IN " + OWING,
                    java.math.BigDecimal.class, id));
            p.put("progress", jdbc.queryForObject(
                    "SELECT COALESCE(ROUND(AVG(progress)),0) FROM tasks WHERE project_id = ? AND is_deleted = 0 "
                            + "AND status <> 'CANCELLED'", Integer.class, id));
            p.put("tasks", jdbc.queryForList(
                    "SELECT t.id, t.task_name AS taskName, t.status, t.due_date AS dueDate, t.progress "
                            + "FROM tasks t WHERE t.is_deleted = 0 AND t.project_id = ? "
                            + "AND t.status NOT IN ('COMPLETED','CANCELLED') ORDER BY t.due_date IS NULL, t.due_date LIMIT 8", id));
            withDetails.add(p);
        }
        return withDetails;
    }

    // --- parcels: supplier shipping IDs and customer order codes ---------------------------------

    private List<Map<String, Object>> parcels(String like) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> s : jdbc.queryForList(
                "SELECT s.id, s.shipping_id AS code, s.status, s.transporter_name AS transporter, s.delivery_place AS place, "
                        + "s.dispatch_date AS dispatchDate, s.received_at AS receivedAt, po.po_number AS poNumber, po.status AS poStatus "
                        + "FROM purchase_order_shipments s JOIN purchase_orders po ON po.id = s.purchase_order_id "
                        + "WHERE s.is_deleted = 0 AND LOWER(s.shipping_id) LIKE ? ORDER BY s.id DESC LIMIT " + LIMIT, like)) {
            s.put("kind", "SHIPMENT");
            out.add(s);
        }
        for (Map<String, Object> b : jdbc.queryForList(
                "SELECT b.id, b.code, b.status, b.work_type AS workType, b.bundle_no AS bundleNo, b.bundle_total AS bundleTotal, "
                        + "b.due_date AS dueDate, b.delivered_at AS deliveredAt, c.name AS customerName, c.phone AS customerPhone, "
                        + "b.task_id AS taskId, b.invoice_id AS invoiceId, "
                        + "(SELECT COALESCE(i.balance_due, i.total_amount) FROM invoices i WHERE i.id = b.invoice_id AND i.is_deleted = 0) AS balanceDue "
                        + "FROM bundles b LEFT JOIN customers c ON c.id = b.customer_id "
                        + "WHERE b.is_deleted = 0 AND (LOWER(b.code) LIKE ? OR LOWER(b.group_code) LIKE ?) "
                        + "ORDER BY b.id DESC LIMIT " + LIMIT, like, like)) {
            b.put("kind", "ORDER");
            out.add(b);
        }
        return out;
    }
}
