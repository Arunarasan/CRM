package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

/**
 * Turns a lead-workflow task's completion into structured data: stores the captured form as a
 * {@link LeadTaskSubmission} (the lead's "Task Data" log) AND applies it to the native lead records
 * an admin already sees — a follow-up creates a LeadFollowup + updates the lead's follow-up fields,
 * a requirement task fills the lead's requirement/budget fields, a qualify task moves status +
 * temperature, and so on. After the data is applied, the task is completed through the normal
 * lifecycle (so approval + workflow advancement are unchanged).
 */
@Service
public class LeadTaskFormService {

    private static final Logger log = LoggerFactory.getLogger(LeadTaskFormService.class);

    @Autowired private TaskRepository taskRepository;
    @Autowired private LeadRepository leadRepository;
    @Autowired private LeadTaskSubmissionRepository submissionRepository;
    @Autowired private LeadService leadService;
    @Autowired private EmployeeTaskService employeeTaskService;
    @Autowired private TaskGenerationService taskGenerationService;
    @Autowired private UserRepository userRepository;
    @Autowired private ObjectMapper objectMapper;

    /** Template-code → form type. Tasks with no mapping have no structured form (generic complete). */
    public String formTypeFor(Task task) {
        if (task == null || task.getTaskTemplate() == null) return null;
        return com.arudra.crm.util.LeadTaskForms.formTypeFor(task.getTaskTemplate().getCode());
    }

    /**
     * Capture a lead task's structured form, apply it to the lead, then complete the task.
     * @param payload {outcome, notes, nextFollowUpDate, media:[{url,type,caption}], data:{...}}
     */
    @Transactional
    public Map<String, Object> submit(Long taskId, User employee, Map<String, Object> payload) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));
        String formType = formTypeFor(task);
        if (formType == null) {
            throw new IllegalStateException("This task has no data form to submit.");
        }
        if (task.getLeadId() == null) {
            throw new IllegalStateException("This task isn't linked to a lead.");
        }
        Lead lead = leadRepository.findById(task.getLeadId())
                .orElseThrow(() -> new RuntimeException("Lead not found for task"));

        payload = payload == null ? Map.of() : payload;
        String outcome = str(payload.get("outcome"));
        String notes = str(payload.get("notes"));
        LocalDate nextFollowUp = date(payload.get("nextFollowUpDate"));
        @SuppressWarnings("unchecked")
        Map<String, Object> data = payload.get("data") instanceof Map
                ? (Map<String, Object>) payload.get("data") : new HashMap<>();

        // 1. Persist the submission (the task-by-task log).
        LeadTaskSubmission sub = new LeadTaskSubmission();
        sub.setTaskId(taskId);
        sub.setLeadId(lead.getId());
        sub.setFormType(formType);
        sub.setTaskName(task.getTaskName());
        sub.setOutcome(outcome);
        sub.setNotes(notes);
        sub.setNextFollowUpDate(nextFollowUp);
        sub.setMediaJson(writeJson(payload.get("media")));
        sub.setDataJson(writeJson(data));
        sub.setSubmittedById(employee.getId());
        sub.setSubmittedByName(employee.getName());
        sub.setSubmittedAt(LocalDateTime.now());
        submissionRepository.save(sub);

        // 1b. Requirement task "next step" branch: schedule the site visit (advance, carrying the date
        //     to the Site Visit task) OR log a follow-up and keep the requirement task OPEN so it can be
        //     re-collected later (the draft submission preserves what was captured so far).
        if ("REQUIREMENT".equals(formType)) {
            LocalDate visitDate = date(data.get("siteVisitDate"));
            LocalDate followUpDate = date(data.get("followUpDate"));
            if (visitDate == null && followUpDate != null) {
                LeadFollowup f = new LeadFollowup();
                f.setFollowupDate(LocalDate.now());
                f.setMethod(strOr(data.get("followUpMethod"), "Call"));
                f.setNotes(strOr(data.get("followUpNotes"), notes));
                f.setOutcome("Follow-up scheduled");
                f.setStatus("Planned");
                f.setNextFollowupDate(followUpDate);
                f.setReminderEnabled(true);
                leadService.addFollowup(lead.getId(), f, employee); // updates lead follow-up fields + timeline

                // Spawn a fresh, dated "Collect Requirement" task for the next attempt (unlimited repeats).
                // Spawn BEFORE completing this one so the LEAD_QUALIFICATION phase keeps an open task and
                // the workflow never advances to Site Visit on a follow-up.
                long attempts = submissionRepository.findByLeadIdOrderBySubmittedAtDesc(lead.getId()).stream()
                        .filter(s -> "REQUIREMENT".equals(s.getFormType())).count();
                Task next = taskGenerationService.spawnRepeatLeadTask(
                        lead.getId(), "TT_COLLECT_REQUIREMENT", followUpDate,
                        "Collect Requirement (Follow-up " + attempts + ")", employee);
                if (next != null) {
                    // Carry what was captured so far onto the new task so the next form pre-fills.
                    LeadTaskSubmission draft = new LeadTaskSubmission();
                    draft.setTaskId(next.getId());
                    draft.setLeadId(lead.getId());
                    draft.setFormType("REQUIREMENT");
                    draft.setTaskName(next.getTaskName());
                    draft.setDataJson(sub.getDataJson());
                    draft.setNotes(notes);
                    draft.setSubmittedById(employee.getId());
                    draft.setSubmittedByName(employee.getName());
                    draft.setSubmittedAt(LocalDateTime.now());
                    draft.setApplied(true); // prefill-only carry-forward — not a real submission to re-apply
                    submissionRepository.save(draft);
                }

                // Close this attempt as COMPLETED right away (a follow-up needs no manager approval, and
                // an un-approved attempt would block the phase). Applies the captured data to the lead.
                employeeTaskService.finalizeLeadAttempt(taskId, employee);
                return toSummary(sub);
            }
            if (visitDate != null) {
                // Record the operational visit date immediately so the Site Visit task materialises with
                // this due date; the full requirement data still applies to the lead on approval.
                lead.setSiteVisitDate(visitDate);
                lead.setSiteVisitRequired(true);
                leadRepository.save(lead);
            }
        }

        // 2. Complete the task through the normal lifecycle. The captured data is NOT written onto the
        //    lead here — it is applied only when the task is truly finalized (auto-finalize, or manager
        //    approval), via the LeadTaskCompletedEvent handled in onLeadTaskCompleted below. For an
        //    OWNER_APPROVAL task this means the lead updates only after the manager approves it.
        employeeTaskService.complete(taskId, employee, notes);

        return toSummary(sub);
    }

    /** Latest captured draft for a lead task (so re-collecting a follow-up shows what was already entered). */
    public Map<String, Object> getLatestDraft(Long taskId) {
        return submissionRepository.findByTaskIdOrderBySubmittedAtDesc(taskId).stream().findFirst()
                .map(s -> {
                    Map<String, Object> m = new HashMap<>(readJsonMap(s.getDataJson()));
                    if (s.getNotes() != null) m.put("notes", s.getNotes());
                    if (s.getNextFollowUpDate() != null) m.put("nextFollowUpDate", s.getNextFollowUpDate().toString());
                    return m;
                })
                .orElse(Map.of());
    }

    /**
     * Applies a task's captured form data onto the native lead once the task is finalized/approved.
     * Fired for every task completion; a no-op for tasks that carry no pending submission.
     */
    @org.springframework.context.event.EventListener
    @Transactional
    public void onLeadTaskCompleted(com.arudra.crm.event.LeadTaskCompletedEvent event) {
        LeadTaskSubmission sub = submissionRepository
                .findFirstByTaskIdAndAppliedFalseOrderBySubmittedAtDescIdDesc(event.getTaskId())
                .orElse(null);
        if (sub == null) return;
        Lead lead = leadRepository.findById(sub.getLeadId()).orElse(null);
        if (lead == null) return;
        User submitter = sub.getSubmittedById() == null ? null
                : userRepository.findById(sub.getSubmittedById()).orElse(null);
        Map<String, Object> data = new HashMap<>(readJsonMap(sub.getDataJson()));
        try {
            applyToLead(sub.getFormType(), lead, submitter, sub.getOutcome(), sub.getNotes(),
                    sub.getNextFollowUpDate(), data);
            sub.setApplied(true);
            submissionRepository.save(sub);
        } catch (Exception e) {
            // Never lose the captured submission if a downstream lead update hiccups.
            log.error("Failed to apply lead-task form ({}) for task {} lead {}",
                    sub.getFormType(), sub.getTaskId(), lead.getId(), e);
        }
    }

    private void applyToLead(String formType, Lead lead, User employee, String outcome, String notes,
                             LocalDate nextFollowUp, Map<String, Object> data) {
        switch (formType) {
            case "FOLLOW_UP" -> {
                LeadFollowup f = new LeadFollowup();
                f.setFollowupDate(LocalDate.now());
                f.setMethod(strOr(data.get("method"), "Call"));
                f.setNotes(notes);
                f.setCustomerResponse(str(data.get("customerResponse")));
                f.setOutcome(outcome);
                f.setStatus("Completed");
                f.setNextFollowupDate(nextFollowUp);
                f.setNextFollowupTime(time(data.get("nextFollowUpTime")));
                f.setReminderEnabled(nextFollowUp != null);
                leadService.addFollowup(lead.getId(), f, employee); // updates lead follow-up fields + timeline
            }
            case "REQUIREMENT" -> {
                // Lead summary + contact
                setIf(str(data.get("name")), lead::setName);
                setIf(str(data.get("companyName")), lead::setCompanyName);
                setIf(str(data.get("contactPerson")), lead::setContactPerson);
                setIf(str(data.get("mobileNumber")), lead::setMobileNumber);
                setIf(str(data.get("alternateMobile")), lead::setAlternateMobile);
                setIf(str(data.get("whatsappNumber")), lead::setWhatsappNumber);
                setIf(str(data.get("email")), lead::setEmail);
                setIf(str(data.get("gstNumber")), lead::setGstNumber);
                // Classification
                setIf(str(data.get("leadType")), lead::setLeadType);
                setIf(str(data.get("priority")), lead::setPriority);
                setIf(str(data.get("leadTemperature")), lead::setLeadTemperature);
                // Address
                setIf(str(data.get("address")), lead::setAddress);
                setIf(str(data.get("city")), lead::setCity);
                setIf(str(data.get("district")), lead::setDistrict);
                setIf(str(data.get("state")), lead::setState);
                setIf(str(data.get("pincode")), lead::setPincode);
                setIf(str(data.get("landmark")), lead::setLandmark);
                setIf(str(data.get("googleMapLocation")), lead::setGoogleMapLocation);
                // Property
                setIf(str(data.get("propertyType")), lead::setPropertyType);
                setIf(str(data.get("currentConstructionStage")), lead::setCurrentConstructionStage);
                setIf(intVal(data.get("floorCount")), lead::setFloorCount);
                setIf(dec(data.get("areaSqft")), lead::setAreaSqft);
                setIf(str(data.get("propertyName")), lead::setPropertyName);
                setIf(str(data.get("siteAddress")), lead::setSiteAddress);
                setIf(dec(data.get("expectedWorkArea")), lead::setExpectedWorkArea);
                // Requirement scope (free text)
                setIf(str(data.get("customerRequirements")), lead::setCustomerRequirements);
                setIf(str(data.get("projectDescription")), lead::setProjectDescription);
                setIf(str(data.get("requirementCategory")), lead::setRequirementCategory);
                setIf(str(data.get("roomsRequired")), lead::setRoomsRequired);
                setIf(str(data.get("specialRequests")), lead::setSpecialRequests);
                // Scope-of-work checklist — authoritative, so set whenever the key is present.
                setBool(data, "reqKitchen", lead::setReqKitchen);
                setBool(data, "reqWardrobe", lead::setReqWardrobe);
                setBool(data, "reqTvUnit", lead::setReqTvUnit);
                setBool(data, "reqFalseCeiling", lead::setReqFalseCeiling);
                setBool(data, "reqPainting", lead::setReqPainting);
                setBool(data, "reqFlooring", lead::setReqFlooring);
                setBool(data, "reqElectrical", lead::setReqElectrical);
                setBool(data, "reqPlumbing", lead::setReqPlumbing);
                setBool(data, "reqWoodFinish", lead::setReqWoodFinish);
                // Preferences
                setIf(str(data.get("preferredDesignStyle")), lead::setPreferredDesignStyle);
                setIf(str(data.get("preferredMaterial")), lead::setPreferredMaterial);
                setIf(str(data.get("preferredColorTheme")), lead::setPreferredColorTheme);
                // Budget & timeline
                setIf(dec(data.get("estimatedBudget")), lead::setEstimatedBudget);
                setIf(dec(data.get("minimumBudget")), lead::setMinimumBudget);
                setIf(dec(data.get("maximumBudget")), lead::setMaximumBudget);
                setIf(dec(data.get("expectedProjectValue")), lead::setExpectedProjectValue);
                setIf(str(data.get("paymentPreference")), lead::setPaymentPreference);
                setIf(date(data.get("expectedStartDate")), lead::setExpectedStartDate);
                setIf(date(data.get("expectedEndDate")), lead::setExpectedEndDate);
                setIf(date(data.get("preferredCompletionDate")), lead::setPreferredCompletionDate);
                setIf(str(data.get("estimatedDuration")), lead::setEstimatedDuration);
                leadRepository.save(lead);
                String summary = str(data.get("projectDescription"));
                if (summary == null) summary = str(data.get("customerRequirements"));
                if (summary == null) summary = str(data.get("roomsRequired"));
                leadService.addNote(lead.getId(), "Requirement captured: " + orDash(summary), employee);
            }
            case "QUALIFY" -> {
                String decision = strOr(data.get("decision"), outcome);   // Qualified | Not Qualified | Nurture
                String temperature = str(data.get("temperature"));        // Hot | Warm | Cold
                if (temperature != null) lead.setLeadTemperature(temperature);
                if ("Qualified".equalsIgnoreCase(decision)) lead.setStatus("Interested");
                else if ("Not Qualified".equalsIgnoreCase(decision)) lead.setStatus("Not Interested");
                leadRepository.save(lead);
                leadService.addNote(lead.getId(),
                        "Qualification: " + orDash(decision)
                                + (temperature != null ? " · " + temperature : "")
                                + (str(data.get("reason")) != null ? " — " + data.get("reason") : ""),
                        employee);
            }
            case "SCHEDULE_VISIT" -> {
                LocalDate visitDate = date(data.get("visitDate"));
                LeadFollowup f = new LeadFollowup();
                f.setFollowupDate(LocalDate.now());
                f.setMethod("Meeting");
                f.setNotes("Site visit scheduled" + (visitDate != null ? " for " + visitDate : "")
                        + (notes != null ? " — " + notes : ""));
                f.setOutcome(outcome);
                f.setStatus("Planned");
                f.setNextFollowupDate(visitDate != null ? visitDate : nextFollowUp);
                f.setNextFollowupTime(time(data.get("visitTime")));
                f.setReminderEnabled(f.getNextFollowupDate() != null);
                leadService.addFollowup(lead.getId(), f, employee);
            }
            case "SITE_VISIT" -> {
                String obs = str(data.get("observations"));
                if (obs != null) {
                    String prev = lead.getSiteNotes();
                    lead.setSiteNotes((prev == null || prev.isBlank()) ? obs : prev + "\n---\n" + obs);
                    leadRepository.save(lead);
                }
                leadService.addNote(lead.getId(), "Site visit done"
                        + (outcome != null ? " (" + outcome + ")" : "")
                        + (obs != null ? ": " + obs : ""), employee);
            }
            case "REVIEW" -> {
                if (notes != null) leadService.addNote(lead.getId(), "Lead reviewed: " + notes, employee);
            }
            default -> { /* no-op */ }
        }
    }

    public List<Map<String, Object>> getSubmissionsForLead(Long leadId) {
        return submissionRepository.findByLeadIdOrderBySubmittedAtDesc(leadId).stream()
                .map(this::toSummary).toList();
    }

    private Map<String, Object> toSummary(LeadTaskSubmission s) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", s.getId());
        m.put("taskId", s.getTaskId());
        m.put("leadId", s.getLeadId());
        m.put("formType", s.getFormType());
        m.put("taskName", s.getTaskName());
        m.put("outcome", s.getOutcome());
        m.put("notes", s.getNotes());
        m.put("nextFollowUpDate", s.getNextFollowUpDate());
        m.put("submittedByName", s.getSubmittedByName());
        m.put("submittedAt", s.getSubmittedAt());
        m.put("media", readJsonList(s.getMediaJson()));
        m.put("data", readJsonMap(s.getDataJson()));
        return m;
    }

    // ---------------------------------------------------------------- small helpers

    private String str(Object o) {
        if (o == null) return null;
        String s = String.valueOf(o).trim();
        return s.isEmpty() ? null : s;
    }
    private String strOr(Object o, String def) { String s = str(o); return s == null ? def : s; }
    private String orDash(String s) { return s == null ? "-" : s; }

    private BigDecimal dec(Object o) {
        String s = str(o);
        if (s == null) return null;
        try { return new BigDecimal(s.replace(",", "")); } catch (NumberFormatException e) { return null; }
    }
    private LocalDate date(Object o) {
        String s = str(o);
        if (s == null) return null;
        try { return LocalDate.parse(s.length() > 10 ? s.substring(0, 10) : s); } catch (Exception e) { return null; }
    }
    private LocalTime time(Object o) {
        String s = str(o);
        if (s == null) return null;
        try { return LocalTime.parse(s.length() > 5 ? s.substring(0, 5) : s); } catch (Exception e) { return null; }
    }
    private <T> void setIf(T val, java.util.function.Consumer<T> setter) {
        if (val != null) setter.accept(val);
    }

    private Integer intVal(Object o) {
        String s = str(o);
        if (s == null) return null;
        try { return Integer.valueOf(s.replaceAll("[^0-9-]", "")); } catch (NumberFormatException e) { return null; }
    }

    /** Parses a checkbox value from JSON boolean or common truthy strings. */
    private Boolean bool(Object o) {
        if (o == null) return null;
        if (o instanceof Boolean b) return b;
        String s = String.valueOf(o).trim().toLowerCase();
        if (s.isEmpty()) return null;
        return s.equals("true") || s.equals("yes") || s.equals("on") || s.equals("1");
    }

    /** Only writes the scope flag when the key is present (so an absent key never clears an existing value). */
    private void setBool(Map<String, Object> data, String key, java.util.function.Consumer<Boolean> setter) {
        if (data.containsKey(key)) {
            Boolean b = bool(data.get(key));
            setter.accept(b != null ? b : Boolean.FALSE);
        }
    }

    private String writeJson(Object o) {
        if (o == null) return null;
        try { return objectMapper.writeValueAsString(o); } catch (Exception e) { return null; }
    }
    @SuppressWarnings("unchecked")
    private List<Object> readJsonList(String json) {
        if (json == null || json.isBlank()) return List.of();
        try { return objectMapper.readValue(json, List.class); } catch (Exception e) { return List.of(); }
    }
    @SuppressWarnings("unchecked")
    private Map<String, Object> readJsonMap(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try { return objectMapper.readValue(json, Map.class); } catch (Exception e) { return Map.of(); }
    }
}
