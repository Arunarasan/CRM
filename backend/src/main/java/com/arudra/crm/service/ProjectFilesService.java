package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Every file that belongs to a project, gathered live into one list for the Documents page: direct
 * uploads plus the lead, measurement, site visits, quotation, invoices, tasks (progress, attachments,
 * chat), daily logs and reports, execution steps, goods receipts and contractor bills/progress.
 *
 * <p>Each entry says what it is (type + one-line description), where it came from (source + link) and
 * who added it. The same file reached through two routes (e.g. a lead photo copied into project
 * documents at conversion) is listed once. Only direct uploads are editable / deletable here — the
 * rest are managed where they came from.
 */
@Service
public class ProjectFilesService {

    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectDocumentRepository documentRepository;
    @Autowired private LeadDocumentRepository leadDocumentRepository;
    @Autowired private CallRecordingService callRecordingService;
    @Autowired private MeasurementRepository measurementRepository;
    @Autowired private MeasurementDrawingRepository drawingRepository;
    @Autowired private MeasurementMediaRepository measurementMediaRepository;
    @Autowired private SiteVisitRepository siteVisitRepository;
    @Autowired private SiteVisitMediaRepository siteVisitMediaRepository;
    @Autowired private QuotationAttachmentRepository quotationAttachmentRepository;
    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskAttachmentRepository taskAttachmentRepository;
    @Autowired private TaskProgressUpdateRepository progressUpdateRepository;
    @Autowired private TaskCommentRepository commentRepository;
    @Autowired private ProjectDailyLogRepository dailyLogRepository;
    @Autowired private ProjectDailyLogMediaRepository dailyLogMediaRepository;
    @Autowired private DailyReportRepository dailyReportRepository;
    @Autowired private ProjectTaskDailyLogRepository taskDailyLogRepository;
    @Autowired private ProjectWorkLineRepository workLineRepository;
    @Autowired private ProjectWorkLineStepRepository workStepRepository;
    @Autowired private ProjectWorkEventRepository workEventRepository;
    @Autowired private GoodsReceiptNoteRepository grnRepository;
    @Autowired private GrnPhotoRepository grnPhotoRepository;
    @Autowired private ContractorBillRepository contractorBillRepository;
    @Autowired private ContractorDailyProgressRepository contractorProgressRepository;
    @Autowired private ContractorProgressMediaRepository contractorMediaRepository;

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd MMM");

    /** Collects entries, dropping a file already listed through another route. */
    private static class Sink {
        final List<Map<String, Object>> items = new ArrayList<>();
        final Set<String> seen = new HashSet<>();

        Map<String, Object> add(String key, String source, String sourceLabel, String type, String fileName,
                                String fileUrl, String description, String addedBy, LocalDateTime addedAt, String link) {
            if (fileUrl == null || fileUrl.isBlank()) return null;
            String norm = fileUrl.trim();
            if (!norm.startsWith("data:") && !seen.add(norm)) return null;
            String kind = kindOf(fileUrl, fileName, type);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", key);
            m.put("source", source);
            m.put("sourceLabel", sourceLabel);
            m.put("type", type);
            m.put("kind", kind);
            m.put("category", categoryOf(kind, type));
            m.put("fileName", fileName != null && !fileName.isBlank() ? fileName : nameFromUrl(fileUrl));
            m.put("fileUrl", fileUrl);
            m.put("description", description);
            m.put("addedBy", addedBy);
            m.put("addedAt", addedAt);
            m.put("link", link);
            m.put("editable", false);
            m.put("generated", false);
            items.add(m);
            return m;
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> listFiles(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        Sink sink = new Sink();
        Long leadId = project.getLead() != null ? project.getLead().getId() : null;
        String projectLink = "/projects/" + projectId;

        // 0. Call recordings that became / were added to the lead — listed first so the plain lead-document
        //    copy of the same file is dropped and the entry keeps its call details (number, time, length…).
        if (leadId != null) {
            for (Map<String, Object> c : callRecordingService.forLead(leadId)) {
                LocalDateTime calledAt = (LocalDateTime) c.get("calledAt");
                Map<String, Object> m = sink.add("CALL-" + c.get("id"), "CALL", "Call recording", "Call recording",
                        (String) c.get("fileName"), (String) c.get("fileUrl"), callSummary(c),
                        (String) c.get("uploadedBy"), calledAt != null ? calledAt : (LocalDateTime) c.get("createdAt"),
                        "/leads/" + leadId);
                if (m != null) {
                    m.put("kind", "audio");
                    m.put("category", "AUDIO");
                    m.put("call", c);
                }
            }
        }

        // 1. Lead — always live (no import needed). Listed before project uploads so the lead copies
        //    made at conversion show as "From lead".
        if (leadId != null) {
            String lead = project.getLead().getLeadNumber() != null ? project.getLead().getLeadNumber() : "lead";
            for (LeadDocument d : leadDocumentRepository.findByLeadId(leadId)) {
                if (Boolean.TRUE.equals(d.getIsDeleted())) continue;
                sink.add("LEAD-" + d.getId(), "LEAD", "From lead " + lead, firstNonBlank(d.getCategory(), d.getDocumentType(), "Lead document"),
                        d.getFileName(), d.getFileUrl(), d.getDescription(), name(d.getUploadedBy()), d.getCreatedAt(), "/leads/" + leadId);
            }
        }

        // 2. Measurements (by project, else by lead) — drawings and site photos.
        Set<Long> measurementIds = new LinkedHashSet<>();
        if (project.getMeasurement() != null) measurementIds.add(project.getMeasurement().getId());
        measurementRepository.findByProjectId(projectId).forEach(m -> measurementIds.add(m.getId()));
        if (leadId != null) measurementRepository.findByLeadId(leadId).forEach(m -> measurementIds.add(m.getId()));
        for (Long mid : measurementIds) {
            for (MeasurementDrawing d : drawingRepository.findByMeasurementId(mid)) {
                if (Boolean.TRUE.equals(d.getIsDeleted())) continue;
                sink.add("MDRAW-" + d.getId(), "MEASUREMENT", "Measurement drawing", firstNonBlank(d.getDrawingType(), "Drawing"),
                        d.getFileName(), d.getFilePath(), d.getDescription(), name(d.getUploadedBy()), d.getCreatedAt(), "/measurements/" + mid);
            }
            for (MeasurementMedia m : measurementMediaRepository.findByMeasurementId(mid)) {
                if (Boolean.TRUE.equals(m.getIsDeleted())) continue;
                String room = m.getMeasurementRoom() != null ? m.getMeasurementRoom().getRoomName() : null;
                sink.add("MMEDIA-" + m.getId(), "MEASUREMENT", "Measurement", firstNonBlank(m.getCategory(), m.getMediaType(), "Site photo"),
                        m.getFileName(), m.getFilePath(), join(" · ", m.getDescription(), room), name(m.getUploadedBy()), m.getCreatedAt(), "/measurements/" + mid);
            }
        }

        // 3. Site visits.
        List<SiteVisit> visits = new ArrayList<>(siteVisitRepository.findByProjectIdAndIsDeletedFalseOrderByScheduledDateDesc(projectId));
        if (leadId != null) visits.addAll(siteVisitRepository.findByLeadIdAndIsDeletedFalseOrderByScheduledDateDesc(leadId));
        Set<Long> visitIds = new HashSet<>();
        for (SiteVisit v : visits) {
            if (!visitIds.add(v.getId())) continue;
            for (SiteVisitMedia m : siteVisitMediaRepository.findBySiteVisitId(v.getId())) {
                if (Boolean.TRUE.equals(m.getIsDeleted())) continue;
                sink.add("VISIT-" + m.getId(), "SITE_VISIT", "Site visit", firstNonBlank(m.getCategory(), m.getMediaType(), "Site photo"),
                        null, m.getFileUrl(), m.getDescription(), name(m.getUploadedBy()),
                        m.getUploadTime() != null ? m.getUploadTime() : m.getCreatedAt(), null);
            }
        }

        // 4. Direct project uploads (editable here).
        for (ProjectDocument d : documentRepository.findByProjectId(projectId)) {
            if (Boolean.TRUE.equals(d.getIsDeleted())) continue;
            boolean handover = "Handover Photos".equalsIgnoreCase(d.getDocumentType());
            Map<String, Object> m = sink.add("DOC-" + d.getId(), handover ? "HANDOVER" : "PROJECT",
                    handover ? "Handover" : "Uploaded to project", firstNonBlank(d.getDocumentType(), "Document"),
                    d.getFileName(), d.getFileUrl(), d.getRemarks(), name(d.getUploadedBy()),
                    d.getUploadDate() != null ? d.getUploadDate() : d.getCreatedAt(), null);
            if (m != null) {
                m.put("docId", d.getId());
                m.put("editable", true);
            }
        }

        // 5. Quotation — the quote itself (generated) + its attachments.
        Quotation quote = project.getQuotation();
        if (quote != null) {
            Map<String, Object> q = sink.add("QUOTE-" + quote.getId(), "QUOTATION", "Quotation", "Quotation",
                    "Quotation " + firstNonBlank(quote.getQuotationNumber(), "#" + quote.getId()) + ".pdf",
                    "/quotations/" + quote.getId() + "/print", "The approved quotation — opens the print / PDF view",
                    null, quote.getCreatedAt(), "/quotations/" + quote.getId());
            if (q != null) { q.put("kind", "pdf"); q.put("category", "DOCUMENT"); q.put("generated", true); }
            for (QuotationAttachment a : quotationAttachmentRepository.findByQuotationId(quote.getId())) {
                if (Boolean.TRUE.equals(a.getIsDeleted())) continue;
                sink.add("QATT-" + a.getId(), "QUOTATION", "Quotation " + firstNonBlank(quote.getQuotationNumber(), ""),
                        firstNonBlank(a.getDocumentType(), "Attachment"), a.getFileName(), a.getFileUrl(), "Attached to the quotation",
                        name(a.getUploadedBy()), a.getCreatedAt(), "/quotations/" + quote.getId());
            }
        }

        // 6. Invoices (generated documents).
        for (Invoice inv : invoiceRepository.findByProjectId(projectId)) {
            if (Boolean.TRUE.equals(inv.getIsDeleted())) continue;
            String no = firstNonBlank(inv.getInvoiceNumber(), "#" + inv.getId());
            Map<String, Object> m = sink.add("INV-" + inv.getId(), "INVOICE", "Billing", "Invoice", "Invoice " + no + ".pdf",
                    "/billing/invoices/" + inv.getId(), join(" · ", inv.getPaymentStage(), "opens the invoice"),
                    null, inv.getCreatedAt(), "/billing/invoices/" + inv.getId());
            if (m != null) { m.put("kind", "pdf"); m.put("category", "BILL"); m.put("generated", true); }
        }

        // 7. Tasks — attachments, progress media, team chat (photos + voice).
        for (Task t : taskRepository.findByProjectId(projectId)) {
            if (Boolean.TRUE.equals(t.getIsDeleted()) || "CANCELLED".equals(t.getStatus())) continue;
            String taskLink = projectLink + "/tasks/" + t.getId();
            for (TaskAttachment a : taskAttachmentRepository.findByTaskId(t.getId())) {
                sink.add("TATT-" + a.getId(), "TASK", "Task · " + t.getTaskName(), "Attachment", a.getFileName(), a.getFileUrl(),
                        null, null, a.getCreatedAt(), taskLink);
            }
            for (TaskProgressUpdate u : progressUpdateRepository.findByTaskIdOrderByCreatedAtDesc(t.getId())) {
                if (u.getMedia() == null) continue;
                for (TaskProgressMedia pm : u.getMedia()) {
                    String type = "VOICE".equalsIgnoreCase(pm.getMediaType()) ? "Voice note"
                            : "VIDEO".equalsIgnoreCase(pm.getMediaType()) ? "Video" : "Progress photo";
                    sink.add("TPROG-" + pm.getId(), "TASK", "Task · " + t.getTaskName(), type, null, pm.getFileUrl(),
                            join(" · ", pm.getCaption(), u.getProgressPercent() != null ? u.getProgressPercent() + "% done" : null, u.getRemarks()),
                            name(u.getEmployee()), u.getCreatedAt(), taskLink);
                }
            }
            for (TaskComment c : commentRepository.findByTaskIdOrderByCreatedAtDesc(t.getId())) {
                String about = c.getTagLabel() != null ? " — " + c.getTagLabel() : "";
                String text = c.getContent() != null && !c.getContent().startsWith("📷") && !c.getContent().startsWith("🎤") ? c.getContent() : null;
                sink.add("CHATIMG-" + c.getId(), "CHAT", "Team chat · " + t.getTaskName(), "Chat photo",
                        null, c.getImageUrl(), join("", "Photo" + about, text != null ? ": " + text : null), name(c.getAuthor()), c.getCreatedAt(), taskLink);
                sink.add("CHATVOICE-" + c.getId(), "CHAT", "Team chat · " + t.getTaskName(), "Voice note",
                        null, c.getAudioUrl(), "Voice message" + about, name(c.getAuthor()), c.getCreatedAt(), taskLink);
            }
            for (ProjectTaskDailyLog l : taskDailyLogRepository.findByTaskIdAndIsDeletedFalseOrderByLogDateDescIdDesc(t.getId())) {
                String day = l.getLogDate() != null ? l.getLogDate().format(DAY) : "";
                String desc = join(" · ", l.getWorkDone(), l.getPercentAfter() != null ? l.getPercentBefore() + "% → " + l.getPercentAfter() + "%" : null);
                int i = 0;
                for (String p : l.getPhotos() == null ? List.<String>of() : l.getPhotos()) {
                    sink.add("TLOG-" + l.getId() + "-" + (i++), "DAILY_LOG", "Daily log " + day + " · " + t.getTaskName(), "Daily log photo",
                            null, p, desc, l.getAuthorName(), l.getCreatedAt(), projectLink + "?tab=workProgress");
                }
                sink.add("TLOGV-" + l.getId(), "DAILY_LOG", "Daily log " + day + " · " + t.getTaskName(), "Voice note",
                        null, l.getAudioUrl(), desc, l.getAuthorName(), l.getCreatedAt(), projectLink + "?tab=workProgress");
            }
        }

        // 8. Execution steps (delivery / stitching / material photos) — current photo + every photo in history.
        Map<Long, ProjectWorkLine> lines = new HashMap<>();
        workLineRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId).forEach(l -> lines.put(l.getId(), l));
        if (!lines.isEmpty()) {
            for (ProjectWorkLineStep s : workStepRepository.findByWorkLineIdInAndIsDeletedFalseOrderBySortOrderAscIdAsc(new ArrayList<>(lines.keySet()))) {
                ProjectWorkLine l = lines.get(s.getWorkLineId());
                sink.add("STEP-" + s.getId(), "WORK_STEP", "Execution · " + l.getCategory(), stepLabel(s.getStepType()) + " photo",
                        null, s.getPhotoUrl(), join(" · ", l.getItemName(), deliveryText(s), s.getNote()), s.getUpdatedByName(),
                        s.getUpdatedAt(), projectLink + "?tab=workProgress");
            }
        }
        for (ProjectWorkEvent e : workEventRepository.findByProjectIdAndIsDeletedFalseOrderByCreatedAtDesc(projectId)) {
            ProjectWorkLine l = e.getWorkLineId() != null ? lines.get(e.getWorkLineId()) : null;
            sink.add("WEV-" + e.getId(), "WORK_STEP", "Execution" + (l != null ? " · " + l.getCategory() : ""), stepLabel(e.getStepType()) + " photo",
                    null, e.getPhotoUrl(), join(" · ", l != null ? l.getItemName() : null, e.getNote()), e.getActorName(),
                    e.getCreatedAt(), projectLink + "?tab=workProgress");
        }

        // 9. Site daily logs and employee daily reports.
        for (ProjectDailyLog log : dailyLogRepository.findByProjectIdOrderByLogDateDesc(projectId)) {
            String day = log.getLogDate() != null ? log.getLogDate().format(DAY) : "";
            for (ProjectDailyLogMedia m : dailyLogMediaRepository.findByDailyLogId(log.getId())) {
                sink.add("DLOG-" + m.getId(), "DAILY_LOG", "Site log " + day, "VIDEO".equalsIgnoreCase(m.getMediaType()) ? "Video" : "Site photo",
                        null, m.getFileUrl(), join(" · ", m.getCaption(), log.getRemarks()), null, m.getCreatedAt(), null);
            }
        }
        for (DailyReport r : dailyReportRepository.findByProjectIdAndIsDeletedFalseOrderByReportDateDescIdDesc(projectId)) {
            String day = r.getReportDate() != null ? r.getReportDate().format(DAY) : "";
            for (DailyReportMedia m : r.getMedia() == null ? List.<DailyReportMedia>of() : r.getMedia()) {
                sink.add("DREP-" + m.getId(), "DAILY_REPORT", "Daily report " + day, "VIDEO".equalsIgnoreCase(m.getMediaType()) ? "Video" : "Report photo",
                        null, m.getFileUrl(), join(" · ", m.getCaption(), r.getRemarks()), name(r.getEmployee()), m.getCreatedAt(), null);
            }
        }

        // 10. Goods received photos.
        for (GoodsReceiptNote grn : grnRepository.findByPurchaseOrderProjectIdOrderByIdDesc(projectId)) {
            String po = grn.getPurchaseOrder() != null ? grn.getPurchaseOrder().getPoNumber() : null;
            for (GrnPhoto p : grnPhotoRepository.findByGrnId(grn.getId())) {
                sink.add("GRN-" + p.getId(), "GRN", firstNonBlank(grn.getGrnNumber(), "Goods received") + (po != null ? " · " + po : ""),
                        "Goods received photo", null, p.getPhotoUrl(), p.getCaption(), null, p.getCreatedAt(), projectLink + "?tab=goodsReceived");
            }
        }

        // 11. Contractors — bill attachments and progress photos.
        for (ContractorBill b : contractorBillRepository.findByProjectIdOrderByIdDesc(projectId)) {
            String who = b.getContractor() != null ? b.getContractor().getName() : "Contractor";
            sink.add("CBILL-" + b.getId(), "CONTRACTOR", who, "Contractor bill", null, b.getAttachmentUrl(),
                    join(" · ", b.getBillNumber(), b.getContractorInvoiceNumber()), null, b.getCreatedAt(), null);
        }
        for (ContractorDailyProgress p : contractorProgressRepository.findByProjectIdOrderByProgressDateDesc(projectId)) {
            String who = p.getContractor() != null ? p.getContractor().getName() : "Contractor";
            for (ContractorProgressMedia m : contractorMediaRepository.findByProgressIdOrderByIdAsc(p.getId())) {
                sink.add("CPROG-" + m.getId(), "CONTRACTOR", who, "Contractor progress photo", m.getFileName(), m.getFileUrl(),
                        join(" · ", m.getCaption(), p.getRemarks()), null, m.getCreatedAt(), null);
            }
        }

        // Newest first; counts for the filter chips.
        sink.items.sort(Comparator.comparing((Map<String, Object> m) -> (LocalDateTime) m.get("addedAt"),
                Comparator.nullsLast(Comparator.reverseOrder())));
        Map<String, Integer> byCategory = new LinkedHashMap<>();
        Map<String, Integer> bySource = new LinkedHashMap<>();
        for (Map<String, Object> m : sink.items) {
            byCategory.merge((String) m.get("category"), 1, Integer::sum);
            bySource.merge((String) m.get("source"), 1, Integer::sum);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("files", sink.items);
        out.put("byCategory", byCategory);
        out.put("bySource", bySource);
        out.put("total", sink.items.size());
        return out;
    }

    // ------------------------------------------------------------------ helpers

    static String kindOf(String url, String fileName, String type) {
        String probe = ((fileName != null ? fileName : "") + " " + (url != null ? url : "")).toLowerCase(Locale.ROOT);
        String t = type == null ? "" : type.toLowerCase(Locale.ROOT);
        if (probe.startsWith("data:image") || url != null && url.startsWith("data:image")) return "image";
        if (matchesExt(probe, "png", "jpg", "jpeg", "gif", "webp", "bmp", "heic", "heif", "avif", "svg")) return "image";
        if (matchesExt(probe, "pdf")) return "pdf";
        if (matchesExt(probe, "mp4", "mov", "webm", "m4v", "avi", "mkv", "3gp")) {
            // webm voice notes are audio
            return t.contains("voice") || t.contains("audio") ? "audio" : "video";
        }
        if (matchesExt(probe, "mp3", "m4a", "wav", "ogg", "aac", "oga", "opus")) return "audio";
        if (matchesExt(probe, "dwg", "dxf", "skp", "rvt")) return "cad";
        if (matchesExt(probe, "xls", "xlsx", "csv")) return "sheet";
        if (matchesExt(probe, "doc", "docx", "txt", "rtf", "odt")) return "doc";
        if (t.contains("voice") || t.contains("audio")) return "audio";
        if (t.contains("video")) return "video";
        if (t.contains("photo") || t.contains("image")) return "image";
        if (t.contains("pdf")) return "pdf";
        return "file";
    }

    private static boolean matchesExt(String probe, String... exts) {
        for (String e : exts) {
            if (probe.matches(".*\\." + e + "(\\?.*|#.*|\\s.*|$)")) return true;
        }
        return false;
    }

    static String categoryOf(String kind, String type) {
        String t = type == null ? "" : type.toLowerCase(Locale.ROOT);
        if (t.contains("invoice") || t.contains("bill") || t.contains("receipt") || t.equals("po")
                || t.contains("purchase order") || t.contains("supplier_quote")) return "BILL";
        if (kind.equals("cad") || t.contains("drawing") || t.contains("floor plan") || t.contains("cad")
                || t.contains("blueprint") || t.contains("sketch") || t.contains("3d")) return "DRAWING";
        if (t.contains("agreement") || t.contains("contract") || t.contains("approval")) return "AGREEMENT";
        return switch (kind) {
            case "image" -> "PHOTO";
            case "video" -> "VIDEO";
            case "audio" -> "AUDIO";
            default -> "DOCUMENT";
        };
    }

    private static String stepLabel(String type) {
        if (type == null) return "Work";
        return switch (type) {
            case "MATERIAL" -> "Material";
            case "MANUFACTURE" -> "Manufacture";
            case "STITCHING" -> "Stitching";
            case "DELIVERY" -> "Delivery";
            case "INSTALL" -> "Installation";
            default -> "Work";
        };
    }

    private static String deliveryText(ProjectWorkLineStep s) {
        if (!"DELIVERY".equals(s.getStepType()) || s.getDeliveryStage() == null) return null;
        String stage = s.getDeliveryStage().replace('_', ' ').toLowerCase(Locale.ROOT);
        return ("PICKUP".equals(s.getDeliveryRoute()) ? "Pickup · " : "Direct · ") + stage;
    }

    /** "+919812345678 · Ravi · 3:42 · Lead created" — the one-line call summary shown on the tile. */
    private static String callSummary(Map<String, Object> c) {
        Integer sec = (Integer) c.get("durationSec");
        String length = sec == null ? null : sec / 60 + ":" + String.format("%02d", sec % 60);
        String outcome = c.get("outcome") == null ? null : switch ((String) c.get("outcome")) {
            case "LEAD_CREATED" -> "Lead created";
            case "ADDED_TO_LEAD" -> "Added to lead";
            default -> "Not a lead";
        };
        return join(" · ", (String) c.get("phoneNumber"), (String) c.get("contactName"), length, outcome);
    }

    private static String name(User u) {
        return u != null ? u.getName() : null;
    }

    private static String nameFromUrl(String url) {
        if (url == null) return "File";
        if (url.startsWith("data:")) return "File";
        String clean = url.split("[?#]")[0];
        String last = clean.substring(clean.lastIndexOf('/') + 1);
        // stored keys look like "<uuid>-original-name.jpg" — drop the uuid
        last = last.replaceFirst("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-?", "");
        return last.isBlank() ? "File" : last;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) if (v != null && !v.isBlank()) return v;
        return null;
    }

    private static String join(String sep, String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p == null || p.isBlank()) continue;
            if (sb.length() > 0) sb.append(sep);
            sb.append(p.trim());
        }
        return sb.length() == 0 ? null : sb.toString();
    }
}
