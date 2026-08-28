package com.arudra.crm.service;

import com.arudra.crm.entity.Task;
import com.arudra.crm.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * The LOCKED ↔ AVAILABLE gate. A workflow task is AVAILABLE only when every task it depends on
 * (instance-level {@code Task.dependencies}, wired at generation time) is COMPLETED; otherwise it
 * stays LOCKED so it never surfaces in the pool prematurely. Manual tasks are never gated here.
 */
@Service
public class TaskDependencyService {

    public static final String LOCKED = "LOCKED";
    public static final String AVAILABLE = "AVAILABLE";
    public static final String COMPLETED = "COMPLETED";

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private TaskPoolNotifier taskPoolNotifier;

    /** True when all of this task's dependencies are COMPLETED (or it has none). */
    public boolean dependenciesSatisfied(Task task) {
        if (task.getDependencies() == null || task.getDependencies().isEmpty()) {
            return true;
        }
        return task.getDependencies().stream().allMatch(d -> COMPLETED.equals(d.getStatus()));
    }

    /** Initial pool status for a freshly generated workflow task. */
    public String initialStatus(Task task) {
        return dependenciesSatisfied(task) ? AVAILABLE : LOCKED;
    }

    /**
     * After {@code completedTask} finished, promote any still-LOCKED sibling in the same workflow
     * instance whose dependencies are now all satisfied. Returns the count promoted.
     */
    public int unlockDependents(Task completedTask) {
        if (completedTask.getWorkflowInstance() == null) return 0;
        int promoted = 0;
        for (Task t : taskRepository.findByWorkflowInstanceId(completedTask.getWorkflowInstance().getId())) {
            if (LOCKED.equals(t.getStatus()) && dependenciesSatisfied(t)) {
                t.setStatus(AVAILABLE);
                Task promotedTask = taskRepository.save(t);
                // Now pickable — tell the eligible workforce it has opened up.
                taskPoolNotifier.notifyEligibleEmployees(promotedTask);
                promoted++;
            }
        }
        return promoted;
    }
}
