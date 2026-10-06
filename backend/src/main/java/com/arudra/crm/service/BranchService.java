package com.arudra.crm.service;

import com.arudra.crm.entity.Branch;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.BranchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/** Branch / office master data used by attendance devices, locations and employees. */
@Service
public class BranchService {

    private final BranchRepository branchRepository;
    private final AttendanceAuditService audit;

    public BranchService(BranchRepository branchRepository, AttendanceAuditService audit) {
        this.branchRepository = branchRepository;
        this.audit = audit;
    }

    public List<Branch> list() {
        return branchRepository.findByIsDeletedFalseOrderByNameAsc();
    }

    @Transactional
    public Branch save(Branch body) {
        if (body.getName() == null || body.getName().isBlank()) throw new IllegalArgumentException("Branch name is required.");
        Branch b = body.getId() == null ? new Branch()
                : branchRepository.findById(body.getId()).filter(x -> !Boolean.TRUE.equals(x.getIsDeleted()))
                    .orElseThrow(() -> new ResourceNotFoundException("Branch not found."));
        boolean created = b.getId() == null;
        b.setName(body.getName().trim());
        String code = body.getCode() == null ? null : body.getCode().trim().toUpperCase(Locale.ROOT);
        b.setCode(code == null || code.isEmpty() ? null : code);
        b.setAddress(body.getAddress());
        b.setCity(body.getCity());
        b.setPhone(body.getPhone());
        b.setActive(body.getActive() == null || body.getActive());
        b = branchRepository.save(b);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, created ? "BRANCH_CREATED" : "BRANCH_UPDATED", b.getId(), b.getName(),
                (created ? "Created" : "Updated") + " branch " + b.getName());
        return b;
    }

    @Transactional
    public void delete(Long id) {
        Branch b = branchRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Branch not found."));
        b.setIsDeleted(true);
        b.setActive(false);
        b.setDeletedAt(LocalDateTime.now());
        branchRepository.save(b);
        audit.audit(AttendanceAuditService.MODULE_DEVICE, "BRANCH_DELETED", b.getId(), b.getName(), "Deleted branch " + b.getName());
    }
}
