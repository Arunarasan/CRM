package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/** Damage reporting: moves quantity out of usable stock into damaged_quantity, with an optional write-off. */
@Service
public class DamageEntryService {

    @Autowired
    private DamageEntryRepository damageEntryRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private InventoryItemRepository itemRepository;

    @Autowired
    private InventoryTransactionRepository transactionRepository;

    public List<DamageEntry> getAll() {
        return damageEntryRepository.findAllByOrderByIdDesc();
    }

    public DamageEntry get(Long id) {
        return damageEntryRepository.findById(id).orElseThrow();
    }

    @Transactional
    public DamageEntry report(Long productId, Long warehouseId, int quantity, String reason,
                               String photoUrl, Long responsiblePersonId, User reportedBy) {
        InventoryItem stock = itemRepository.findByProductIdAndWarehouseId(productId, warehouseId).orElseThrow(
                () -> new IllegalStateException("No stock record for this product at this warehouse"));
        if (stock.getAvailableQuantity() < quantity) {
            throw new IllegalStateException("Cannot report more damage than is available in stock");
        }
        stock.setQuantity(stock.getQuantity() - quantity);
        stock.setDamagedQuantity(stock.getDamagedQuantity() + quantity);
        itemRepository.save(stock);

        DamageEntry entry = new DamageEntry();
        entry.setProduct(productRepository.findById(productId).orElseThrow());
        entry.setWarehouse(warehouseRepository.findById(warehouseId).orElseThrow());
        entry.setQuantity(quantity);
        entry.setReason(reason);
        entry.setPhotoUrl(photoUrl);
        if (responsiblePersonId != null) {
            entry.setResponsiblePerson(userRepository.findById(responsiblePersonId).orElseThrow());
        }
        entry.setReportedBy(reportedBy);
        entry.setStatus("REPORTED");
        entry = damageEntryRepository.save(entry);

        InventoryTransaction tx = new InventoryTransaction();
        tx.setProduct(entry.getProduct());
        tx.setSourceWarehouse(entry.getWarehouse());
        tx.setType("DAMAGE");
        tx.setQuantity(quantity);
        tx.setDate(LocalDateTime.now());
        tx.setReferenceType("DAMAGE_ENTRY");
        tx.setReferenceId(entry.getId());
        tx.setNotes(reason);
        transactionRepository.save(tx);

        return entry;
    }

    public DamageEntry writeOff(Long id) {
        DamageEntry entry = get(id);
        entry.setStatus("WRITTEN_OFF");
        return damageEntryRepository.save(entry);
    }
}
