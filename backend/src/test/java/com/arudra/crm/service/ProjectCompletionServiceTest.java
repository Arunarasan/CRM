package com.arudra.crm.service;

import com.arudra.crm.entity.PaymentSchedule;
import com.arudra.crm.entity.ProjectCustomerApproval;
import com.arudra.crm.entity.ProjectQualityCheck;
import com.arudra.crm.entity.Task;
import com.arudra.crm.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/**
 * Unit-tests the project completion GATE (§42) with mocked module state — no Spring/DB.
 */
class ProjectCompletionServiceTest {

    @Mock TaskRepository taskRepository;
    @Mock ProjectQualityCheckRepository qualityCheckRepository;
    @Mock ProjectCustomerApprovalRepository customerApprovalRepository;
    @Mock PaymentScheduleRepository paymentScheduleRepository;
    @Mock WorkflowInstanceRepository workflowInstanceRepository;
    @Mock WorkflowPhaseInstanceRepository workflowPhaseInstanceRepository;

    @InjectMocks ProjectCompletionService svc;

    private static final Long PID = 7L;

    @BeforeEach
    void setup() {
        MockitoAnnotations.openMocks(this);
        // Default happy-path stubs; individual tests override what they exercise.
        when(taskRepository.findByProjectId(PID)).thenReturn(List.of());
        when(qualityCheckRepository.findByProjectId(PID)).thenReturn(List.of());
        when(customerApprovalRepository.findByProjectId(PID)).thenReturn(List.of(approval("APPROVED", "Completion Approval")));
        when(workflowInstanceRepository.findByProjectId(PID)).thenReturn(List.of());
        when(paymentScheduleRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(PID)).thenReturn(List.of());
    }

    private ProjectCustomerApproval approval(String status, String type) {
        ProjectCustomerApproval a = new ProjectCustomerApproval();
        a.setStatus(status);
        a.setApprovalType(type);
        return a;
    }

    private Task task(String status) {
        Task t = new Task();
        t.setStatus(status);
        return t;
    }

    private PaymentSchedule schedule(String status) {
        PaymentSchedule s = new PaymentSchedule();
        s.setStatus(status);
        return s;
    }

    private ProjectQualityCheck check(String status) {
        ProjectQualityCheck c = new ProjectQualityCheck();
        c.setStatus(status);
        return c;
    }

    @Test
    void allConditionsMet_isReady() {
        Map<String, Object> report = svc.evaluate(PID);
        assertTrue((Boolean) report.get("ready"));
        assertTrue(((List<?>) report.get("unmet")).isEmpty());
    }

    @Test
    void outstandingBilling_blocksCompletion() {
        when(paymentScheduleRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(PID))
                .thenReturn(List.of(schedule("PAID"), schedule("PENDING")));
        Map<String, Object> report = svc.evaluate(PID);
        assertFalse((Boolean) report.get("ready"));
        assertTrue(((List<?>) report.get("unmet")).contains("Billing conditions satisfied"));
    }

    @Test
    void missingCustomerApproval_blocksCompletion() {
        when(customerApprovalRepository.findByProjectId(PID)).thenReturn(List.of()); // none on file
        Map<String, Object> report = svc.evaluate(PID);
        assertFalse((Boolean) report.get("ready"));
        assertTrue(((List<?>) report.get("unmet")).contains("Customer approval received"));
    }

    @Test
    void failedQualityCheck_blocksCompletion() {
        when(qualityCheckRepository.findByProjectId(PID)).thenReturn(List.of(check("REWORK_REQUIRED")));
        Map<String, Object> report = svc.evaluate(PID);
        assertFalse((Boolean) report.get("ready"));
        assertTrue(((List<?>) report.get("unmet")).contains("Quality inspection passed"));
    }

    @Test
    void incompleteWork_blocksCompletion() {
        when(taskRepository.findByProjectId(PID)).thenReturn(List.of(task("COMPLETED"), task("IN_PROGRESS")));
        Map<String, Object> report = svc.evaluate(PID);
        assertFalse((Boolean) report.get("ready"));
        assertTrue(((List<?>) report.get("unmet")).contains("Required work completed"));
    }
}
