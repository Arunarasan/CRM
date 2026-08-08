package com.arudra.crm.service;

import com.arudra.crm.entity.InventoryCategory;
import com.arudra.crm.repository.InventoryCategoryRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class InventoryCategoryService {

    @Autowired
    private InventoryCategoryRepository categoryRepository;

    public List<InventoryCategory> getAll() {
        return categoryRepository.findAll();
    }

    /** Top-level categories only; each has its children nested via the lazy `parent` back-reference on the frontend tree builder. */
    public List<InventoryCategory> getRootCategories() {
        return categoryRepository.findAll().stream()
                .filter(c -> c.getParent() == null)
                .toList();
    }

    public InventoryCategory get(Long id) {
        return categoryRepository.findById(id).orElseThrow();
    }

    public InventoryCategory create(InventoryCategory category) {
        return categoryRepository.save(category);
    }

    public InventoryCategory update(Long id, InventoryCategory details) {
        InventoryCategory category = get(id);
        category.setName(details.getName());
        category.setDescription(details.getDescription());
        category.setCode(details.getCode());
        category.setParent(details.getParent());
        return categoryRepository.save(category);
    }

    public void delete(Long id) {
        boolean hasChildren = categoryRepository.findAll().stream()
                .anyMatch(c -> c.getParent() != null && c.getParent().getId().equals(id));
        if (hasChildren) {
            throw new IllegalStateException("Cannot delete a category that has sub-categories; move or delete them first.");
        }
        categoryRepository.deleteById(id);
    }
}
