package com.arudra.crm.service;

import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.TaskChecklist;
import com.arudra.crm.entity.TaskChecklistItem;
import com.arudra.crm.repository.TaskChecklistItemRepository;
import com.arudra.crm.repository.TaskChecklistRepository;
import com.arudra.crm.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Gives every task a "so the employee knows what to do" checklist. On task creation (manual or
 * BOQ-generated) a basic, trade-aware set of work steps is seeded automatically; managers can also
 * (re)apply a template or add their own items when assigning. Kept separate from
 * {@link EmployeeTaskService} so both the desktop (manager) and mobile (employee) sides can reuse it
 * without pulling in employee-auth concerns.
 */
@Service
public class TaskChecklistService {

    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskChecklistRepository checklistRepository;
    @Autowired private TaskChecklistItemRepository checklistItemRepository;

    public static final String DEFAULT_NAME = "Work Steps";

    /** Steps derived from the task's trade (skills/name/description), with a generic fallback. */
    public List<String> defaultItemsFor(Task task) {
        String hay = ((task.getRequiredSkills() == null ? "" : task.getRequiredSkills()) + " " +
                      (task.getTaskName() == null ? "" : task.getTaskName()) + " " +
                      (task.getDescription() == null ? "" : task.getDescription())).toLowerCase();
        return stepsFor(hay);
    }

    private List<String> stepsFor(String hay) {
        List<String> steps = new ArrayList<>();
        // Common opening steps — apply to every trade.
        steps.add("Review task details, drawings & specifications");
        steps.add("Confirm required materials & tools are available");
        steps.add("Verify the work area is ready and safe to start");

        // Trade-specific middle steps — this is what tells the employee their role on the job.
        if (matches(hay, "electr", "wiring", "cabling", "switch", "socket", "conduit", "mcb", "db board")) {
            steps.add("Isolate power / complete safety lockout");
            steps.add("Lay conduits and pull wiring as per the layout");
            steps.add("Terminate connections and test circuits (continuity & load)");
        } else if (matches(hay, "plumb", "pipe", "sanitary", "cpvc", "upvc", "drain", "faucet", "tap", "wc ", "basin")) {
            steps.add("Isolate the water supply before starting");
            steps.add("Lay and join pipes as per the drawing");
            steps.add("Pressure-test joints and check for leaks");
        } else if (matches(hay, "paint", "putty", "primer", "emulsion", "polish", "texture")) {
            steps.add("Prepare the surface — clean, putty and sand");
            steps.add("Apply primer coat and allow to dry");
            steps.add("Apply finish coats evenly");
        } else if (matches(hay, "carpent", "wood", "ply", "furniture", "door", "modular", "wardrobe", "cabinet")) {
            steps.add("Take final site measurements before cutting");
            steps.add("Assemble and install as per the design");
            steps.add("Check alignment, level and hardware operation");
        } else if (matches(hay, "tile", "floor", "marble", "granite", "vitrified", "flooring")) {
            steps.add("Check surface level and set out reference lines");
            steps.add("Lay tiles with correct spacing and adhesive");
            steps.add("Grout the joints and clean the surface");
        } else if (matches(hay, "pop", "ceiling", "gypsum", "false ceiling", "cornice")) {
            steps.add("Mark levels and fix the framework");
            steps.add("Fix boards and finish the joints");
            steps.add("Sand and prepare the surface for painting");
        } else {
            steps.add("Carry out the work as per the specification");
            steps.add("Do a self quality-check of the completed work");
        }

        // Common closing steps.
        steps.add("Clean up the work area");
        steps.add("Upload progress / completion photos");
        steps.add("Mark the task for supervisor inspection & approval");
        return steps;
    }

    private boolean matches(String hay, String... keys) {
        for (String k : keys) if (hay.contains(k)) return true;
        return false;
    }

    /** Seeds the default checklist only if the task has none yet (idempotent). Returns true if created. */
    @Transactional
    public boolean ensureDefaultChecklist(Task task) {
        if (task == null || task.getId() == null) return false;
        if (!checklistRepository.findByTaskId(task.getId()).isEmpty()) return false;
        applyItems(task, DEFAULT_NAME, defaultItemsFor(task));
        return true;
    }

    /** (Re)applies a checklist to a task. template null/blank/"AUTO" ⇒ trade auto-detection. */
    @Transactional
    public Map<String, Object> applyTemplate(Long taskId, String template) {
        Task task = taskRepository.findById(taskId).orElseThrow(() -> new RuntimeException("Task not found"));
        List<String> items = (template == null || template.isBlank() || template.equalsIgnoreCase("AUTO"))
                ? defaultItemsFor(task)
                : stepsFor(template.toLowerCase());
        return toSummary(applyItems(task, DEFAULT_NAME, items));
    }

    private TaskChecklist applyItems(Task task, String name, List<String> contents) {
        TaskChecklist checklist = new TaskChecklist();
        checklist.setTask(task);
        checklist.setName(name);
        checklist = checklistRepository.save(checklist);
        int i = 0;
        for (String content : contents) {
            TaskChecklistItem item = new TaskChecklistItem();
            item.setChecklist(checklist);
            item.setContent(content);
            item.setOrderIndex(i++);
            checklistItemRepository.save(item);
        }
        return checklist;
    }

    /** All checklists for a task as compact maps (no entity graph → no Jackson cycle). */
    public List<Map<String, Object>> getChecklists(Long taskId) {
        return checklistRepository.findByTaskId(taskId).stream()
                .map(this::toSummary).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> addItem(Long taskId, String checklistName, String content) {
        Task task = taskRepository.findById(taskId).orElseThrow(() -> new RuntimeException("Task not found"));
        String name = (checklistName == null || checklistName.isBlank()) ? DEFAULT_NAME : checklistName;
        TaskChecklist checklist = checklistRepository.findByTaskId(taskId).stream()
                .filter(c -> c.getName().equalsIgnoreCase(name))
                .findFirst()
                .orElseGet(() -> {
                    TaskChecklist c = new TaskChecklist();
                    c.setTask(task);
                    c.setName(name);
                    return checklistRepository.save(c);
                });
        int order = checklistItemRepository.findByChecklistId(checklist.getId()).size();
        TaskChecklistItem item = new TaskChecklistItem();
        item.setChecklist(checklist);
        item.setContent(content);
        item.setOrderIndex(order);
        checklistItemRepository.save(item);
        return toSummary(checklistRepository.findById(checklist.getId()).orElseThrow());
    }

    @Transactional
    public Map<String, Object> toggleItem(Long itemId) {
        TaskChecklistItem item = checklistItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Checklist item not found"));
        item.setIsCompleted(!Boolean.TRUE.equals(item.getIsCompleted()));
        TaskChecklistItem saved = checklistItemRepository.save(item);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", saved.getId());
        m.put("content", saved.getContent());
        m.put("isCompleted", saved.getIsCompleted());
        m.put("orderIndex", saved.getOrderIndex());
        return m;
    }

    private Map<String, Object> toSummary(TaskChecklist c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("name", c.getName());
        m.put("items", checklistItemRepository.findByChecklistId(c.getId()).stream()
                .sorted((a, b) -> Integer.compare(
                        a.getOrderIndex() == null ? 0 : a.getOrderIndex(),
                        b.getOrderIndex() == null ? 0 : b.getOrderIndex()))
                .map(i -> {
                    Map<String, Object> im = new LinkedHashMap<>();
                    im.put("id", i.getId());
                    im.put("content", i.getContent());
                    im.put("isCompleted", i.getIsCompleted());
                    im.put("orderIndex", i.getOrderIndex());
                    return im;
                })
                .collect(Collectors.toList()));
        return m;
    }
}
