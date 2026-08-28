package com.arudra.crm.service;

import com.arudra.crm.entity.ServiceReview;
import com.arudra.crm.repository.ServiceReviewRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Admin moderation of service reviews. Staff can list every review, hide/approve one, or delete it.
 * Only APPROVED reviews are shown to other customers / the public.
 */
@Service
public class ServiceReviewAdminService {

    private static final Set<String> STATUSES = Set.of("APPROVED", "HIDDEN");

    private final ServiceReviewRepository repo;

    public ServiceReviewAdminService(ServiceReviewRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (ServiceReview r : repo.findByIsDeletedFalseOrderByCreatedAtDesc()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("serviceTitle", r.getService() != null ? r.getService().getTitle() : null);
            m.put("customerName", r.getCustomer() != null ? r.getCustomer().getName() : null);
            m.put("rating", r.getRating());
            m.put("comment", r.getComment());
            m.put("status", r.getStatus());
            m.put("createdAt", r.getCreatedAt());
            out.add(m);
        }
        return out;
    }

    @Transactional
    public void setStatus(Long id, String status) {
        if (status == null || !STATUSES.contains(status.trim().toUpperCase())) {
            throw new IllegalArgumentException("Unknown status: " + status);
        }
        ServiceReview r = load(id);
        r.setStatus(status.trim().toUpperCase());
        repo.save(r);
    }

    @Transactional
    public void delete(Long id) {
        ServiceReview r = load(id);
        r.setIsDeleted(true);
        r.setDeletedAt(LocalDateTime.now());
        repo.save(r);
    }

    private ServiceReview load(Long id) {
        return repo.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new EntityNotFoundException("Review not found: " + id));
    }
}
