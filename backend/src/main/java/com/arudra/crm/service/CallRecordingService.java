package com.arudra.crm.service;

import com.arudra.crm.dto.workforce.AssignResourceRequest;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import com.arudra.crm.storage.AudioTranscoder;
import com.arudra.crm.storage.StorageService;
import com.arudra.crm.storage.StoredFile;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Tasks & Workforce → Call Recordings: upload phone-call recordings, read the caller's number /
 * call time / length from each, raise "Call follow-up" tasks from them, and close each call with an
 * outcome — a new lead (built from the task's lead form), the call added to an existing lead, or
 * "not a lead". Recording a lead outcome links the lead to the task and completes the task.
 */
@Service
@RequiredArgsConstructor
public class CallRecordingService {

    public static final String TASK_SOURCE = "CALL_RECORDING";
    private static final long MAX_SIZE_BYTES = 25L * 1024 * 1024;
    private static final Set<String> AUDIO_EXTENSIONS = Set.of(
            "mp3", "m4a", "aac", "amr", "3gp", "3ga", "awb", "wav", "ogg", "oga", "opus", "webm", "wma", "flac", "mp4");
    private static final DateTimeFormatter TASK_TIME = DateTimeFormatter.ofPattern("dd MMM, h:mm a", Locale.ENGLISH);

    private final CallRecordingRepository repository;
    private final TaskRepository taskRepository;
    private final TaskAttachmentRepository attachmentRepository;
    private final TaskAssignmentRepository assignmentRepository;
    private final LeadRepository leadRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final AudioTranscoder audioTranscoder;
    private final EmployeeTaskService employeeTaskService;
    private final EmployeePortalService employeePortalService;
    private final LeadService leadService;
    private final LeadDocumentRepository leadDocumentRepository;

    @org.springframework.beans.factory.annotation.Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    // ------------------------------------------------------------------ upload & list

    /**
     * Stores one recording (converted to .m4a when browsers can't play it), reads its details and
     * looks for an existing lead on the same number. {@code lastModified} (epoch ms from the
     * browser) stands in for the call time when the file name has none; {@code clientDurationSec}
     * is used when the server can't measure the length itself.
     */
    @Transactional
    public Map<String, Object> upload(MultipartFile file, Long lastModified, Integer clientDurationSec, User me) throws IOException {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("The file is empty.");
        if (file.getSize() > MAX_SIZE_BYTES) throw new IllegalArgumentException("File exceeds the 25 MB limit.");
        String originalName = StringUtils.cleanPath(file.getOriginalFilename() == null ? "recording" : file.getOriginalFilename());
        String ext = originalName.contains(".") ? originalName.substring(originalName.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        String contentType = file.getContentType();
        if (!(contentType != null && contentType.startsWith("audio/")) && !AUDIO_EXTENSIONS.contains(ext)) {
            throw new IllegalArgumentException("Only audio recordings can be uploaded here.");
        }

        byte[] bytes = file.getBytes();
        String storedName = originalName;
        String storedType = contentType;
        if (audioTranscoder.needsTranscode(contentType, originalName, bytes)) {
            AudioTranscoder.Result converted = audioTranscoder.toM4a(bytes, originalName);
            if (converted != null) {
                bytes = converted.bytes();
                storedName = converted.fileName();
                storedType = converted.contentType();
            }
        }
        Integer duration = audioTranscoder.probeDurationSec(bytes, storedName);
        if (duration == null && clientDurationSec != null && clientDurationSec > 0) duration = clientDurationSec;

        StoredFile stored = storageService.store(bytes, storedType, "CALL_RECORDING", storedName);

        CallMetadataExtractor.CallMeta meta = CallMetadataExtractor.parse(originalName);
        CallRecording rec = new CallRecording();
        rec.setFileUrl(stored.fileUrl());
        rec.setFileName(originalName);
        rec.setSizeBytes((long) bytes.length);
        rec.setDurationSec(duration);
        rec.setPhoneNumber(meta.phoneNumber());
        rec.setCalledAt(meta.calledAt() != null ? meta.calledAt()
                : lastModified != null && lastModified > 0
                    ? LocalDateTime.ofInstant(Instant.ofEpochMilli(lastModified), ZoneId.systemDefault())
                    : null);
        rec.setDirection(meta.direction());
        rec.setContactName(meta.contactName());
        rec.setUploadedById(me != null ? me.getId() : null);
        rec.setMatchedLeadId(matchLeadId(rec.getPhoneNumber()));
        return toDto(repository.save(rec));
    }

    /**
     * Re-checks a recording that was stored before its audio could be converted (e.g. AMR audio in a
     * ".m4a" file) and, when the browser can't play it, converts it to AAC .m4a and points the call,
     * its task attachment and any lead document at the new file. A no-op when it already plays.
     */
    @Transactional
    public Map<String, Object> makePlayable(Long id) throws IOException {
        CallRecording rec = get(id);
        byte[] bytes = readStored(rec.getFileUrl());
        if (!audioTranscoder.needsTranscode("audio/unknown", rec.getFileName(), bytes)) {
            if (audioTranscoder.probeCodec(bytes, rec.getFileName()) == null) {
                throw new IllegalStateException("The server can't read this recording's audio.");
            }
            return toDto(rec); // already AAC / MP3
        }
        AudioTranscoder.Result converted = audioTranscoder.toM4a(bytes, rec.getFileName());
        if (converted == null) throw new IllegalStateException("This recording couldn't be converted.");
        StoredFile stored = storageService.store(converted.bytes(), converted.contentType(), "CALL_RECORDING", converted.fileName());
        String oldUrl = rec.getFileUrl();
        rec.setFileUrl(stored.fileUrl());
        rec.setSizeBytes((long) converted.bytes().length);
        if (rec.getDurationSec() == null) rec.setDurationSec(audioTranscoder.probeDurationSec(converted.bytes(), converted.fileName()));
        for (TaskAttachment a : attachmentRepository.findByFileUrl(oldUrl)) {
            a.setFileUrl(stored.fileUrl());
            attachmentRepository.save(a);
        }
        for (LeadDocument d : leadDocumentRepository.findByFileUrl(oldUrl)) {
            d.setFileUrl(stored.fileUrl());
            leadDocumentRepository.save(d);
        }
        return toDto(repository.save(rec));
    }

    /** Bytes of a file this app stored: a public storage URL, or a local "/uploads/..." path. */
    private byte[] readStored(String url) throws IOException {
        if (url.startsWith("/uploads/")) { // LocalStorageService (dev)
            java.nio.file.Path root = java.nio.file.Path.of(uploadDir).toAbsolutePath().normalize();
            java.nio.file.Path file = root.resolve(url.substring("/uploads/".length()).split("[?#]")[0]).normalize();
            if (!file.startsWith(root)) throw new IllegalStateException("Bad file path.");
            return java.nio.file.Files.readAllBytes(file);
        }
        try {
            var res = java.net.http.HttpClient.newBuilder()
                    .connectTimeout(java.time.Duration.ofSeconds(10))
                    .followRedirects(java.net.http.HttpClient.Redirect.NORMAL).build()
                    .send(java.net.http.HttpRequest.newBuilder(java.net.URI.create(url.replace(" ", "%20")))
                                    .timeout(java.time.Duration.ofSeconds(60)).GET().build(),
                            java.net.http.HttpResponse.BodyHandlers.ofByteArray());
            if (res.statusCode() != 200) throw new IllegalStateException("Couldn't fetch the recording (" + res.statusCode() + ").");
            return res.body();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException(e);
        }
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        return repository.findByIsDeletedFalseOrderByIdDesc().stream().map(this::toDto).toList();
    }

    /** Admin edits the details read from the file (number, time, name, note) before raising a task. */
    @Transactional
    public Map<String, Object> update(Long id, Map<String, Object> body) {
        CallRecording rec = get(id);
        if (body.containsKey("phoneNumber")) {
            String raw = str(body.get("phoneNumber"));
            String phone = raw == null ? null : CallMetadataExtractor.normalizePhone(raw);
            if (raw != null && phone == null) throw new IllegalArgumentException("That doesn't look like a phone number.");
            rec.setPhoneNumber(phone);
            rec.setMatchedLeadId(matchLeadId(phone));
        }
        if (body.containsKey("calledAt")) {
            String t = str(body.get("calledAt"));
            rec.setCalledAt(t == null ? null : LocalDateTime.parse(t.length() == 16 ? t + ":00" : t));
        }
        if (body.containsKey("contactName")) rec.setContactName(str(body.get("contactName")));
        if (body.containsKey("note")) rec.setNote(str(body.get("note")));
        CallRecording saved = repository.save(rec);
        syncTaskText(saved);
        return toDto(saved);
    }

    /** Removes a recording that hasn't become a task yet. */
    @Transactional
    public void discard(Long id, User me) {
        CallRecording rec = get(id);
        if (rec.getTaskId() != null) {
            throw new IllegalStateException("A task was already created from this call — close it from the task instead.");
        }
        rec.setStatus(CallRecording.DISCARDED);
        rec.setIsDeleted(true);
        rec.setDeletedAt(LocalDateTime.now());
        rec.setDeletedBy(me != null ? me.getEmail() : null);
        repository.save(rec);
    }

    // ------------------------------------------------------------------ tasks

    /**
     * Raises one "Call follow-up" task per selected recording, assigned to the chosen employee /
     * contractor (who is notified). Recordings that already have a task are skipped.
     */
    @Transactional
    public List<Map<String, Object>> createTasks(List<Long> ids, String resourceType, Long resourceId,
                                                 LocalDate dueDate, String priority, User me) {
        if (ids == null || ids.isEmpty()) throw new IllegalArgumentException("Pick at least one recording.");
        if (resourceId == null) throw new IllegalArgumentException("Choose who should follow up the call.");
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long id : ids) {
            CallRecording rec = get(id);
            if (rec.getTaskId() != null) {
                out.add(toDto(rec));
                continue;
            }
            Task task = new Task();
            task.setTaskName(taskName(rec));
            task.setDescription(taskDescription(rec));
            task.setSource(TASK_SOURCE);
            task.setStatus("PENDING");
            task.setPriority(priority == null || priority.isBlank() ? "MEDIUM" : priority.toUpperCase(Locale.ROOT));
            task.setStartDate(LocalDate.now());
            task.setDueDate(dueDate != null ? dueDate : LocalDate.now().plusDays(1));
            task.setCompletionRule("ANY_PARTICIPANT");
            Task saved = taskRepository.save(task);

            TaskAttachment att = new TaskAttachment();
            att.setTask(saved);
            att.setFileName(truncate(rec.getFileName(), 200));
            att.setFileUrl(rec.getFileUrl());
            attachmentRepository.save(att);

            employeeTaskService.assignResources(saved.getId(),
                    List.of(new AssignResourceRequest(resourceType == null ? "EMPLOYEE" : resourceType, resourceId, null)), me);

            rec.setTaskId(saved.getId());
            rec.setStatus(CallRecording.TASK_CREATED);
            out.add(toDto(repository.save(rec)));
        }
        return out;
    }

    /** The call behind a follow-up task, for the task screens (null when the task isn't a call). */
    @Transactional(readOnly = true)
    public Map<String, Object> forTask(Long taskId, User me) {
        CallRecording rec = repository.findFirstByTaskIdAndIsDeletedFalse(taskId).orElse(null);
        if (rec == null) return null;
        requireCanAct(rec, me);
        return toDto(rec);
    }

    /** Every call that ended up on this lead (created it, or was added to it), newest first. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> forLead(Long leadId) {
        return repository.findByLeadIdAndIsDeletedFalseOrderByIdDesc(leadId).stream().map(this::toDto).toList();
    }

    // ------------------------------------------------------------------ outcomes

    /**
     * Creates a lead from the task's lead form (same fields as the mobile Add Lead), attaches the
     * recording to it, links the lead to the task and completes the task.
     */
    @Transactional
    public Map<String, Object> createLead(Long id, Map<String, Object> body, User me) {
        CallRecording rec = get(id);
        requireCanAct(rec, me);
        requireOpen(rec);
        Map<String, Object> form = new HashMap<>(body);
        if (str(form.get("mobileNumber")) == null && rec.getPhoneNumber() != null) form.put("mobileNumber", rec.getPhoneNumber());
        Lead lead = employeePortalService.createLeadFromForm(me, form, "Call Recording");
        attachRecording(rec, lead.getId(), me, form.get("documents"));
        return finish(rec, CallRecording.LEAD_CREATED, lead.getId(), null, me);
    }

    /** Adds the call (recording + a note) to an existing lead instead of creating a duplicate. */
    @Transactional
    public Map<String, Object> attachToLead(Long id, Long leadId, String note, User me) {
        CallRecording rec = get(id);
        requireCanAct(rec, me);
        requireOpen(rec);
        Lead lead = leadRepository.findById(leadId)
                .filter(l -> !Boolean.TRUE.equals(l.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Lead not found."));
        attachRecording(rec, lead.getId(), me, null);
        String line = "Call " + (rec.getCalledAt() != null ? rec.getCalledAt().format(TASK_TIME) : "")
                + (note != null && !note.isBlank() ? " — " + note.trim() : "");
        lead.setRemarks(lead.getRemarks() == null || lead.getRemarks().isBlank() ? line : lead.getRemarks() + "\n" + line);
        leadRepository.save(lead);
        return finish(rec, CallRecording.ADDED_TO_LEAD, lead.getId(), note, me);
    }

    /** Closes the call as not a lead (wrong number, not interested, spam…) with a reason. */
    @Transactional
    public Map<String, Object> notALead(Long id, String reason, User me) {
        CallRecording rec = get(id);
        requireCanAct(rec, me);
        requireOpen(rec);
        if (reason == null || reason.isBlank()) throw new IllegalArgumentException("Give a reason.");
        return finish(rec, CallRecording.NOT_A_LEAD, null, reason.trim(), me);
    }

    private Map<String, Object> finish(CallRecording rec, String outcome, Long leadId, String reason, User me) {
        rec.setOutcome(outcome);
        rec.setLeadId(leadId);
        rec.setOutcomeReason(truncate(reason, 500));
        rec.setOutcomeById(me != null ? me.getId() : null);
        rec.setOutcomeAt(LocalDateTime.now());
        rec.setStatus(CallRecording.DONE);
        CallRecording saved = repository.save(rec);
        if (rec.getTaskId() != null) {
            taskRepository.findById(rec.getTaskId()).ifPresent(task -> {
                if (leadId != null) {
                    task.setLeadId(leadId);
                    taskRepository.save(task);
                }
                employeeTaskService.closeCallFollowUp(task.getId(), me);
            });
        }
        return toDto(saved);
    }

    /** Puts the recording on the lead's Documents (Voice Notes) unless the form already sent it. */
    private void attachRecording(CallRecording rec, Long leadId, User me, Object formDocuments) {
        if (formDocuments instanceof List<?> docs && docs.stream()
                .anyMatch(d -> d instanceof Map<?, ?> m && rec.getFileUrl().equals(m.get("fileUrl")))) {
            return;
        }
        LeadDocument doc = new LeadDocument();
        doc.setFileUrl(rec.getFileUrl());
        doc.setFileName(truncate("Call recording " + (rec.getCalledAt() != null ? rec.getCalledAt().format(TASK_TIME) : rec.getFileName()), 200));
        doc.setDocumentType("Audio");
        doc.setCategory("Voice Notes");
        leadService.addDocument(leadId, doc, me);
    }

    // ------------------------------------------------------------------ helpers

    private CallRecording get(Long id) {
        return repository.findById(id)
                .filter(r -> !Boolean.TRUE.equals(r.getIsDeleted()))
                .orElseThrow(() -> new IllegalArgumentException("Call recording not found."));
    }

    private void requireOpen(CallRecording rec) {
        if (rec.getOutcome() != null) throw new IllegalStateException("This call is already closed.");
    }

    /** Managers / admins act on any call; anyone else only on a call whose task is assigned to them. */
    private void requireCanAct(CallRecording rec, User me) {
        if (isManager()) return;
        boolean assigned = me != null && rec.getTaskId() != null && assignmentRepository
                .findByTaskIdAndResourceTypeAndResourceId(rec.getTaskId(), "EMPLOYEE", me.getId())
                .filter(a -> !"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus()))
                .isPresent();
        if (!assigned) throw new org.springframework.security.access.AccessDeniedException("This call isn't assigned to you.");
    }

    private static boolean isManager() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        return auth.getAuthorities().stream().map(GrantedAuthority::getAuthority).anyMatch(a ->
                a.equals("ROLE_ADMIN") || a.equals("ROLE_MANAGER") || a.equals("ROLE_PROJECT_MANAGER") || a.equals("TASK_ASSIGN"));
    }

    private Long matchLeadId(String phone) {
        String digits = CallMetadataExtractor.last10(phone);
        return digits == null ? null : leadRepository.findLatestByPhoneDigits(digits).map(Lead::getId).orElse(null);
    }

    private String taskName(CallRecording rec) {
        String who = rec.getContactName() != null ? rec.getContactName()
                : rec.getPhoneNumber() != null ? rec.getPhoneNumber() : "Unknown number";
        String when = rec.getCalledAt() != null ? " · " + rec.getCalledAt().format(TASK_TIME) : "";
        return truncate("Call follow-up · " + who + when, 200);
    }

    private String taskDescription(CallRecording rec) {
        List<String> lines = new ArrayList<>();
        if (rec.getPhoneNumber() != null) lines.add("Phone: " + rec.getPhoneNumber());
        if (rec.getContactName() != null) lines.add("Name: " + rec.getContactName());
        if (rec.getCalledAt() != null) lines.add("Call time: " + rec.getCalledAt().format(TASK_TIME));
        if (rec.getDurationSec() != null) lines.add("Length: " + rec.getDurationSec() / 60 + " min " + rec.getDurationSec() % 60 + " sec");
        if (rec.getNote() != null) lines.add("Note: " + rec.getNote());
        lines.add("Listen to the recording, call back if needed, then create the lead (or mark it Not a lead).");
        return String.join("\n", lines);
    }

    /** Keeps an open task's title / description in step when the admin corrects the call details. */
    private void syncTaskText(CallRecording rec) {
        if (rec.getTaskId() == null || rec.getOutcome() != null) return;
        taskRepository.findById(rec.getTaskId()).ifPresent(t -> {
            t.setTaskName(taskName(rec));
            t.setDescription(taskDescription(rec));
            taskRepository.save(t);
        });
    }

    private Map<String, Object> toDto(CallRecording r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("fileUrl", r.getFileUrl());
        m.put("fileName", r.getFileName());
        m.put("sizeBytes", r.getSizeBytes());
        m.put("durationSec", r.getDurationSec());
        m.put("phoneNumber", r.getPhoneNumber());
        m.put("calledAt", r.getCalledAt());
        m.put("direction", r.getDirection());
        m.put("contactName", r.getContactName());
        m.put("note", r.getNote());
        m.put("status", r.getStatus());
        m.put("outcome", r.getOutcome());
        m.put("outcomeReason", r.getOutcomeReason());
        m.put("outcomeAt", r.getOutcomeAt());
        m.put("createdAt", r.getCreatedAt());
        m.put("taskId", r.getTaskId());
        if (r.getTaskId() != null) {
            taskRepository.findById(r.getTaskId()).ifPresent(t -> {
                m.put("taskStatus", t.getStatus());
                m.put("taskName", t.getTaskName());
                m.put("dueDate", t.getDueDate());
                m.put("assigneeName", t.getAssignedEmployee() != null ? t.getAssignedEmployee().getName()
                        : t.getContractor() != null ? t.getContractor().getName() : null);
            });
        }
        m.put("matchedLead", leadRef(r.getMatchedLeadId()));
        m.put("lead", leadRef(r.getLeadId()));
        m.put("uploadedBy", r.getUploadedById() == null ? null
                : userRepository.findById(r.getUploadedById()).map(User::getName).orElse(null));
        m.put("outcomeBy", r.getOutcomeById() == null ? null
                : userRepository.findById(r.getOutcomeById()).map(User::getName).orElse(null));
        return m;
    }

    private Map<String, Object> leadRef(Long leadId) {
        if (leadId == null) return null;
        return leadRepository.findById(leadId).map(l -> {
            Map<String, Object> ref = new LinkedHashMap<>();
            ref.put("id", l.getId());
            ref.put("leadNumber", l.getLeadNumber());
            ref.put("name", l.getName());
            ref.put("status", l.getStatus());
            return ref;
        }).orElse(null);
    }

    private static String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
