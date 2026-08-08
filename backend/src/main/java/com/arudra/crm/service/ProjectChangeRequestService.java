package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Customer-driven scope/budget changes on a Project — distinct from a PM's direct day-to-day BOQ edits.
 * A ProjectChangeRequest carries a requested/approved/rejected/completed workflow; approving one applies
 * its {@link ProjectChangeRequestPhase} activate/deactivate lines as a single new BOQ revision, then
 * cascades the change through tasks, material requirements/inventory, and a new quotation revision.
 */
@Service
public class ProjectChangeRequestService {

    @Autowired private ProjectChangeRequestRepository changeRequestRepository;
    @Autowired private ProjectChangeRequestPhaseRepository changeRequestPhaseRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectPhaseRepository projectPhaseRepository;
    @Autowired private BoqPhaseRepository boqPhaseRepository;
    @Autowired private ProjectActivityLogRepository projectActivityLogRepository;
    @Autowired private BoqService boqService;
    @Autowired private ProjectService projectService;
    @Autowired private WorkPackageService workPackageService;
    @Autowired private NotificationService notificationService;

    @Transactional(readOnly = true)
    public Page<ProjectChangeRequest> getByStatus(String status, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("id").descending());
        return status != null && !status.isBlank()
                ? changeRequestRepository.findByStatusOrderByIdDesc(status, pageRequest)
                : changeRequestRepository.findAll(pageRequest);
    }

    @Transactional(readOnly = true)
    public List<ProjectChangeRequest> getByProject(Long projectId) {
        return changeRequestRepository.findByProjectIdOrderByIdDesc(projectId);
    }

    @Transactional(readOnly = true)
    public ProjectChangeRequest getById(Long id) {
        return changeRequestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Change request not found"));
    }

    @Transactional
    public ProjectChangeRequest create(Long projectId, ProjectChangeRequest details, User currentUser) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        ProjectChangeRequest cr = new ProjectChangeRequest();
        cr.setRequestNumber(nextRequestNumber());
        cr.setProject(project);
        cr.setCustomer(project.getCustomer());
        cr.setRequestedBy(currentUser);
        cr.setRequestDate(LocalDate.now());
        cr.setReason(details.getReason());
        cr.setChangeType(details.getChangeType());
        cr.setDescription(details.getDescription());
        cr.setStatus("PENDING");
        ProjectChangeRequest saved = changeRequestRepository.save(cr);
        logProjectActivity(project, currentUser, "Change request " + saved.getRequestNumber() + " (" + saved.getChangeType() + ") submitted");
        return saved;
    }

    @Transactional
    public ProjectChangeRequestPhase addPhaseAction(Long changeRequestId, Long projectPhaseId, String action) {
        ProjectChangeRequest cr = getById(changeRequestId);
        ProjectPhase phase = projectPhaseRepository.findById(projectPhaseId)
                .orElseThrow(() -> new RuntimeException("Project phase not found"));
        ProjectChangeRequestPhase line = new ProjectChangeRequestPhase();
        line.setChangeRequest(cr);
        line.setProjectPhase(phase);
        line.setAction(action);
        return changeRequestPhaseRepository.save(line);
    }

    @Transactional(readOnly = true)
    public List<ProjectChangeRequestPhase> getPhaseActions(Long changeRequestId) {
        return changeRequestPhaseRepository.findByChangeRequestId(changeRequestId);
    }

    @Transactional
    public void removePhaseAction(Long lineId) {
        changeRequestPhaseRepository.deleteById(lineId);
    }

    /**
     * Approves the change request and immediately applies it: creates a new BOQ revision, toggles the
     * requested phases active/inactive on it, auto-approves that revision, reconciles the project
     * (cascading to tasks/materials/inventory), and generates a fresh quotation revision reflecting the change.
     */
    @Transactional
    public ProjectChangeRequest approve(Long id, User currentUser) {
        ProjectChangeRequest cr = getById(id);
        Project project = cr.getProject();
        if (project.getBoq() == null) {
            throw new IllegalStateException("This project has no BOQ linked yet — link one before applying change requests.");
        }

        cr.setStatus("APPROVED");
        cr.setApprovedBy(currentUser);
        cr.setApprovalDate(LocalDateTime.now());

        Boq currentBoq = project.getBoq();
        Boq newRevision = "APPROVED".equals(currentBoq.getStatus())
                ? boqService.createRevision(currentBoq.getId(), currentUser)
                : currentBoq;
        project.setBoq(newRevision);
        projectRepository.save(project);

        // createRevision clones BoqPhases with brand-new ids, so every ProjectPhase.boqPhaseId (which
        // still points at the pre-revision phase) needs remapping — match by name (cloning preserves it
        // verbatim) to find each phase's counterpart on the new revision. This must cover ALL of the
        // project's phases, not just the ones this change request touches: reconcileProjectWithBoq (run
        // right after) keys its upserts on boqPhaseId, and a stale id would create duplicate ProjectPhases
        // instead of updating the existing ones.
        List<BoqPhase> newRevisionPhases = boqPhaseRepository.findByBoqIdOrderBySequenceAsc(newRevision.getId());
        for (ProjectPhase projectPhase : projectPhaseRepository.findByProjectIdOrderBySequenceAsc(project.getId())) {
            if (projectPhase.getBoqPhaseId() == null) continue;
            BoqPhase oldPhase = boqPhaseRepository.findById(projectPhase.getBoqPhaseId()).orElse(null);
            if (oldPhase == null) continue;
            newRevisionPhases.stream()
                    .filter(p -> p.getPhaseName().equals(oldPhase.getPhaseName()))
                    .findFirst()
                    .ifPresent(clonedPhase -> {
                        projectPhase.setBoqPhaseId(clonedPhase.getId());
                        projectPhaseRepository.save(projectPhase);
                    });
        }

        List<ProjectChangeRequestPhase> lines = changeRequestPhaseRepository.findByChangeRequestId(id);
        for (ProjectChangeRequestPhase line : lines) {
            ProjectPhase projectPhase = projectPhaseRepository.findById(line.getProjectPhase().getId()).orElse(null);
            if (projectPhase == null || projectPhase.getBoqPhaseId() == null) continue;
            boolean activate = "ACTIVATE".equals(line.getAction());
            boqService.togglePhaseActive(newRevision.getId(), projectPhase.getBoqPhaseId(), activate,
                    "Change request " + cr.getRequestNumber() + ": " + cr.getReason(), currentUser);
        }

        // The whole point of an approved change request is immediate effect — bypass manual review.
        Boq approvedRevision = boqService.approveBoq(newRevision.getId(), currentUser);
        cr.setResultingBoqId(approvedRevision.getId());

        Map<String, Object> reconciliation = projectService.reconcileProjectWithBoq(project.getId(), currentUser);

        // Contractor scope follows the BOQ: any live work package whose value moved gets a PENDING
        // variation raised for the PM. Non-fatal — the BOQ/task cascade above already applied.
        try {
            workPackageService.reconcileWithBoqRevision(project.getId(), cr.getId(),
                    "Change request " + cr.getRequestNumber() + ": " + cr.getReason(), currentUser);
        } catch (Exception e) {
            logProjectActivity(project, currentUser, "Change request " + cr.getRequestNumber()
                    + " applied, but contractor work package reconciliation failed: " + e.getMessage());
        }

        try {
            Quotation quotation = boqService.generateQuotationFromBoq(approvedRevision.getId(), "FULL_HOUSE", null, null, currentUser);
            cr.setResultingQuotationId(quotation.getId());
        } catch (Exception e) {
            // Non-fatal — the BOQ/task/inventory cascade already applied; a quotation can be generated manually.
            logProjectActivity(project, currentUser, "Change request " + cr.getRequestNumber()
                    + " applied, but quotation generation failed: " + e.getMessage());
        }

        changeRequestRepository.save(cr);
        logProjectActivity(project, currentUser, "Change request " + cr.getRequestNumber() + " approved and applied — "
                + reconciliation.get("tasksCancelled") + " task(s) cancelled, " + reconciliation.get("tasksReactivated")
                + " reactivated, " + reconciliation.get("materialsReleased") + " material requirement(s) released");

        if (project.getProjectManager() != null) {
            notificationService.dispatch("Change Request Approved",
                    cr.getRequestNumber() + " was approved and applied to " + project.getProjectName(),
                    "PROJECT", project.getProjectManager().getId(), "/projects/" + project.getId());
        }
        return cr;
    }

    @Transactional
    public ProjectChangeRequest reject(Long id, String reason, User currentUser) {
        ProjectChangeRequest cr = getById(id);
        cr.setStatus("REJECTED");
        cr.setRejectionReason(reason);
        cr.setApprovedBy(currentUser);
        cr.setApprovalDate(LocalDateTime.now());
        ProjectChangeRequest saved = changeRequestRepository.save(cr);
        logProjectActivity(cr.getProject(), currentUser, "Change request " + cr.getRequestNumber() + " rejected"
                + (reason != null ? ": " + reason : ""));
        return saved;
    }

    @Transactional
    public ProjectChangeRequest complete(Long id, User currentUser) {
        ProjectChangeRequest cr = getById(id);
        if (!"APPROVED".equals(cr.getStatus())) {
            throw new RuntimeException("Only an approved change request can be marked completed");
        }
        cr.setStatus("COMPLETED");
        cr.setCompletedDate(LocalDateTime.now());
        ProjectChangeRequest saved = changeRequestRepository.save(cr);
        logProjectActivity(cr.getProject(), currentUser, "Change request " + cr.getRequestNumber() + " marked completed");
        return saved;
    }

    private void logProjectActivity(Project project, User user, String description) {
        ProjectActivityLog log = new ProjectActivityLog();
        log.setProject(project);
        log.setUser(user);
        log.setRole(user != null && !user.getRoles().isEmpty() ? user.getRoles().iterator().next().getName() : "System");
        log.setDescription(description);
        projectActivityLogRepository.save(log);
    }

    private synchronized String nextRequestNumber() {
        List<String> latest = changeRequestRepository.findLatestRequestNumbers(PageRequest.of(0, 1));
        long next = 1;
        if (!latest.isEmpty()) {
            try {
                next = Long.parseLong(latest.get(0).substring("CR-".length())) + 1;
            } catch (NumberFormatException e) {
                return "CR-" + System.currentTimeMillis();
            }
        }
        return String.format("CR-%06d", next);
    }
}
