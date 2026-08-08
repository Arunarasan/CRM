package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Employee/field material request workflow: PENDING -> APPROVED/REJECTED -> ISSUED. */
@Service
public class MaterialRequestService {

    @Autowired
    private MaterialRequestRepository requestRepository;

    @Autowired
    private MaterialRequestItemRepository requestItemRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private InventoryItemRepository itemRepository;

    @Autowired
    private InventoryTransactionRepository transactionRepository;

    @Autowired
    private NotificationService notificationService;

    public List<MaterialRequest> getAll() {
        return requestRepository.findAllByOrderByIdDesc();
    }

    public List<MaterialRequest> getByStatus(String status) {
        return requestRepository.findByStatusOrderByIdDesc(status);
    }

    public List<MaterialRequest> getMine(Long userId) {
        return requestRepository.findByRequestedByIdOrderByIdDesc(userId);
    }

    public MaterialRequest get(Long id) {
        return requestRepository.findById(id).orElseThrow();
    }

    @Transactional
    public MaterialRequest create(Long taskId, Long projectId, Long warehouseId,
                                   List<Map<String, Object>> items, String remarks, User requestedBy) {
        MaterialRequest request = new MaterialRequest();
        request.setRequestNumber("MR-" + System.currentTimeMillis());
        if (taskId != null) {
            request.setTask(taskRepository.findById(taskId).orElseThrow());
        }
        if (projectId != null) {
            request.setProject(projectRepository.findById(projectId).orElseThrow());
        }
        if (warehouseId != null) {
            request.setWarehouse(warehouseRepository.findById(warehouseId).orElseThrow());
        }
        request.setRequestedBy(requestedBy);
        request.setStatus("PENDING");
        request.setRemarks(remarks);
        request = requestRepository.save(request);

        for (Map<String, Object> line : items) {
            Long productId = Long.valueOf(String.valueOf(line.get("productId")));
            int quantity = Integer.parseInt(String.valueOf(line.get("quantity")));
            MaterialRequestItem item = new MaterialRequestItem();
            item.setRequest(request);
            item.setProduct(productRepository.findById(productId).orElseThrow());
            item.setQuantity(quantity);
            requestItemRepository.save(item);
            request.getItems().add(item);
        }

        String mrMessage = request.getRequestNumber() + " raised by "
                + (requestedBy != null ? requestedBy.getName() : "an employee");
        if (request.getProject() != null && request.getProject().getProjectManager() != null) {
            notificationService.dispatch("Material Request", mrMessage,
                    "MATERIAL_REQUEST", request.getProject().getProjectManager().getId(),
                    "/inventory/material-requests");
        }
        // Admins see every raised material request (spec: admin gets material-request alerts).
        notificationService.dispatchToAdmins("Material Request", mrMessage, "MATERIAL_REQUEST",
                "/inventory/material-requests", requestedBy != null ? requestedBy.getId() : null);
        return request;
    }

    public MaterialRequest approve(Long id, User approvedBy) {
        MaterialRequest request = get(id);
        if (!"PENDING".equals(request.getStatus())) {
            throw new IllegalStateException("Only a PENDING request can be approved");
        }
        request.setStatus("APPROVED");
        request.setApprovedBy(approvedBy);
        request.setDecidedAt(LocalDateTime.now());
        MaterialRequest saved = requestRepository.save(request);
        if (saved.getRequestedBy() != null) {
            notificationService.dispatch("Material Approved",
                    "Your material request " + saved.getRequestNumber() + " was approved.",
                    "MATERIAL_REQUEST", saved.getRequestedBy().getId(), "/employee/requests/material");
        }
        return saved;
    }

    public MaterialRequest reject(Long id, User approvedBy, String reason) {
        MaterialRequest request = get(id);
        if (!"PENDING".equals(request.getStatus())) {
            throw new IllegalStateException("Only a PENDING request can be rejected");
        }
        request.setStatus("REJECTED");
        request.setApprovedBy(approvedBy);
        request.setDecidedAt(LocalDateTime.now());
        request.setRemarks((request.getRemarks() != null ? request.getRemarks() + " | " : "") + "Rejected: " + reason);
        MaterialRequest saved = requestRepository.save(request);
        if (saved.getRequestedBy() != null) {
            notificationService.dispatch("Material Rejected",
                    "Your material request " + saved.getRequestNumber() + " was rejected: " + reason,
                    "MATERIAL_REQUEST", saved.getRequestedBy().getId(), "/employee/requests/material");
        }
        return saved;
    }

    /** Deducts available stock from the request's warehouse and marks the items issued. */
    @Transactional
    public MaterialRequest issue(Long id) {
        MaterialRequest request = get(id);
        if (!"APPROVED".equals(request.getStatus())) {
            throw new IllegalStateException("Only an APPROVED request can be issued");
        }
        if (request.getWarehouse() == null) {
            throw new IllegalStateException("Request has no warehouse to issue from");
        }
        for (MaterialRequestItem line : requestItemRepository.findByRequestId(id)) {
            int toIssue = line.getQuantity() - line.getIssuedQuantity();
            if (toIssue <= 0) continue;
            InventoryItem stock = itemRepository.findByProductIdAndWarehouseId(
                    line.getProduct().getId(), request.getWarehouse().getId()).orElseThrow(
                    () -> new IllegalStateException("No stock record for " + line.getProduct().getName()));
            if (stock.getAvailableQuantity() < toIssue) {
                throw new IllegalStateException("Insufficient available stock for " + line.getProduct().getName());
            }
            stock.setQuantity(stock.getQuantity() - toIssue);
            itemRepository.save(stock);
            line.setIssuedQuantity(line.getIssuedQuantity() + toIssue);
            requestItemRepository.save(line);

            InventoryTransaction tx = new InventoryTransaction();
            tx.setProduct(line.getProduct());
            tx.setSourceWarehouse(request.getWarehouse());
            tx.setType("CONSUMPTION");
            tx.setQuantity(toIssue);
            tx.setDate(LocalDateTime.now());
            tx.setReference(request.getRequestNumber());
            tx.setReferenceType("MATERIAL_REQUEST");
            tx.setReferenceId(request.getId());
            if (request.getProject() != null) {
                tx.setProject(request.getProject());
            }
            transactionRepository.save(tx);
        }
        request.setStatus("ISSUED");
        MaterialRequest saved = requestRepository.save(request);
        if (saved.getRequestedBy() != null) {
            notificationService.dispatch("Material Issued",
                    "Materials for " + saved.getRequestNumber() + " have been issued.",
                    "MATERIAL_REQUEST", saved.getRequestedBy().getId(), "/employee/requests/material");
        }
        return saved;
    }
}
