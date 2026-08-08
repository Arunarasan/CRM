package com.arudra.crm.service;

import com.arudra.crm.entity.Product;
import com.arudra.crm.entity.ProductSupplier;
import com.arudra.crm.entity.Supplier;
import com.arudra.crm.repository.ProductRepository;
import com.arudra.crm.repository.ProductSupplierRepository;
import com.arudra.crm.repository.SupplierRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/** Multi-supplier links per material, with one optionally marked preferred. */
@Service
public class ProductSupplierService {

    @Autowired
    private ProductSupplierRepository productSupplierRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    public List<ProductSupplier> getForProduct(Long productId) {
        return productSupplierRepository.findByProductId(productId);
    }

    public ProductSupplier add(Long productId, Long supplierId, ProductSupplier details) {
        Product product = productRepository.findById(productId).orElseThrow();
        Supplier supplier = supplierRepository.findById(supplierId).orElseThrow();
        if (Boolean.TRUE.equals(details.getIsPreferred())) {
            clearExistingPreferred(productId);
        }
        ProductSupplier link = new ProductSupplier();
        link.setProduct(product);
        link.setSupplier(supplier);
        link.setPurchasePrice(details.getPurchasePrice());
        link.setLeadTimeDays(details.getLeadTimeDays());
        link.setIsPreferred(Boolean.TRUE.equals(details.getIsPreferred()));
        link.setLastPurchaseDate(details.getLastPurchaseDate());
        return productSupplierRepository.save(link);
    }

    public ProductSupplier update(Long id, ProductSupplier details) {
        ProductSupplier link = productSupplierRepository.findById(id).orElseThrow();
        if (Boolean.TRUE.equals(details.getIsPreferred()) && !Boolean.TRUE.equals(link.getIsPreferred())) {
            clearExistingPreferred(link.getProduct().getId());
        }
        link.setPurchasePrice(details.getPurchasePrice());
        link.setLeadTimeDays(details.getLeadTimeDays());
        link.setIsPreferred(Boolean.TRUE.equals(details.getIsPreferred()));
        link.setLastPurchaseDate(details.getLastPurchaseDate());
        return productSupplierRepository.save(link);
    }

    public void delete(Long id) {
        productSupplierRepository.deleteById(id);
    }

    /** Preferred product-supplier link if one is marked, else falls back to the product's single legacy supplier field. */
    public Optional<Supplier> getPreferredSupplier(Long productId) {
        Optional<ProductSupplier> preferred = productSupplierRepository.findByProductId(productId).stream()
                .filter(ProductSupplier::getIsPreferred)
                .findFirst();
        if (preferred.isPresent()) {
            return preferred.map(ProductSupplier::getSupplier);
        }
        return productRepository.findById(productId).map(Product::getSupplier);
    }

    private void clearExistingPreferred(Long productId) {
        for (ProductSupplier existing : productSupplierRepository.findByProductId(productId)) {
            if (Boolean.TRUE.equals(existing.getIsPreferred())) {
                existing.setIsPreferred(false);
                productSupplierRepository.save(existing);
            }
        }
    }
}
