package com.arudra.crm.service;

import com.arudra.crm.entity.MeasurementItemCatalog;
import com.arudra.crm.repository.MeasurementItemCatalogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** CRUD for the admin-managed measurement item catalog. */
@Service
public class MeasurementItemCatalogService {

    @Autowired
    private MeasurementItemCatalogRepository repository;

    /** Active items only — what the employee measurement picker shows. */
    public List<MeasurementItemCatalog> listActive() {
        return repository.findByActiveTrueAndIsDeletedFalseOrderByOrderIndexAscNameAsc();
    }

    /** All (including inactive) — the admin management view. */
    public List<MeasurementItemCatalog> listAll() {
        return repository.findByIsDeletedFalseOrderByOrderIndexAscNameAsc();
    }

    @Transactional
    public MeasurementItemCatalog create(MeasurementItemCatalog item) {
        item.setId(null);
        if (item.getActive() == null) item.setActive(true);
        return repository.save(item);
    }

    @Transactional
    public MeasurementItemCatalog update(Long id, MeasurementItemCatalog patch) {
        MeasurementItemCatalog existing = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Catalog item not found"));
        if (patch.getName() != null) existing.setName(patch.getName());
        existing.setItemType(patch.getItemType());
        existing.setDefaultUnit(patch.getDefaultUnit());
        existing.setDefaultMaterial(patch.getDefaultMaterial());
        if (patch.getActive() != null) existing.setActive(patch.getActive());
        if (patch.getOrderIndex() != null) existing.setOrderIndex(patch.getOrderIndex());
        return repository.save(existing);
    }

    @Transactional
    public void delete(Long id) {
        repository.findById(id).ifPresent(item -> {
            item.setIsDeleted(true);
            item.setDeletedAt(LocalDateTime.now());
            repository.save(item);
        });
    }
}
