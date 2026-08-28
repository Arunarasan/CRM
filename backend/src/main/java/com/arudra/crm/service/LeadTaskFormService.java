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

        // 2. Apply to the native lead records the admin already sees.
        try {
            applyToLead(formType, lead, employee, outcome, notes, nextFollowUp, data);
        } catch (Exception e) {
            // Data capture must not be lost if a downstream lead update hiccups.
            log.error("Failed to apply lead-task form ({}) for task {} lead {}", formType, taskId, lead.getId(), e);
        }

        // 3. Complete the task through the normal lifecycle (respects OWNER_APPROVAL + workflow advance).
        employeeTaskService.complete(taskId, employee, notes);

        return toSummary(sub);
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
                setIf(str(data.get("customerRequirements")), lead::setCustomerRequirements);
                setIf(str(data.get("projectDescription")), lead::setProjectDescription);
                setIf(str(data.get("requirementCategory")), lead::setRequirementCategory);
                setIf(str(data.get("roomsRequired")), lead::setRoomsRequired);
                setIf(str(data.get("preferredDesignStyle")), lead::setPreferredDesignStyle);
                setIf(str(data.get("preferredMaterial")), lead::setPreferredMaterial);
                setIf(dec(data.get("estimatedBudget")), lead::setEstimatedBudget);
                setIf(dec(data.get("minimumBudget")), lead::setMinimumBudget);
                setIf(dec(data.get("maximumBudget")), lead::setMaximumBudget);
                setIf(date(data.get("preferredCompletionDate")), lead::setPreferredCompletionDate);
                leadRepository.save(lead);
                leadService.addNote(lead.getId(), "Requirement captured: "
                        + orDash(str(data.get("customerRequirements"))), employee);
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
