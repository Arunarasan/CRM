package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Warehouse-to-warehouse transfer workflow: REQUESTED -> APPROVED -> IN_TRANSIT -> RECEIVED (or CANCELLED). */
@Service
public class StockTransferService {

    @Autowired
    private StockTransferRepository transferRepository;

    @Autowired
    private StockTransferItemRepository transferItemRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private InventoryItemRepository itemRepository;

    @Autowired
    private InventoryTransactionRepository transactionRepository;

    public List<StockTransfer> getAll() {
        return transferRepository.findAllByOrderByIdDesc();
    }

    public List<StockTransfer> getByStatus(String status) {
        return transferRepository.findByStatusOrderByIdDesc(status);
    }

    public StockTransfer get(Long id) {
        return transferRepository.findById(id).orElseThrow();
    }

    @Transactional
    public StockTransfer create(Long sourceWarehouseId, Long destinationWarehouseId,
                                 List<Map<String, Object>> items, String notes, User requestedBy) {
        if (sourceWarehouseId.equals(destinationWarehouseId)) {
            throw new IllegalArgumentException("Source and destination warehouse must be different");
        }
        StockTransfer transfer = new StockTransfer();
        transfer.setTransferNumber("TR-" + System.currentTimeMillis());
        transfer.setSourceWarehouse(warehouseRepository.findById(sourceWarehouseId).orElseThrow());
        transfer.setDestinationWarehouse(warehouseRepository.findById(destinationWarehouseId).orElseThrow());
        transfer.setStatus("REQUESTED");
        transfer.setRequestedBy(requestedBy);
        transfer.setNotes(notes);
        transfer = transferRepository.save(transfer);

        for (Map<String, Object> line : items) {
            Long productId = Long.valueOf(String.valueOf(line.get("productId")));
            int quantity = Integer.parseInt(String.valueOf(line.get("quantity")));
            StockTransferItem item = new StockTransferItem();
            item.setTransfer(transfer);
            item.setProduct(productRepository.findById(productId).orElseThrow());
            item.setQuantity(quantity);
            transferItemRepository.save(item);
            transfer.getItems().add(item);
        }
        return transfer;
    }

    public StockTransfer approve(Long id, User approvedBy) {
        StockTransfer transfer = get(id);
        if (!"REQUESTED".equals(transfer.getStatus())) {
            throw new IllegalStateException("Only a REQUESTED transfer can be approved");
        }
        transfer.setStatus("APPROVED");
        transfer.setApprovedBy(approvedBy);
        return transferRepository.save(transfer);
    }

    public StockTransfer reject(Long id) {
        StockTransfer transfer = get(id);
        if (!"REQUESTED".equals(transfer.getStatus())) {
            throw new IllegalStateException("Only a REQUESTED transfer can be rejected");
        }
        transfer.setStatus("CANCELLED");
        return transferRepository.save(transfer);
    }

    /** Pulls stock out of the source warehouse into in-transit. */
    @Transactional
    public StockTransfer markInTransit(Long id) {
        StockTransfer transfer = get(id);
        if (!"APPROVED".equals(transfer.getStatus())) {
            throw new IllegalStateException("Only an APPROVED transfer can be marked in-transit");
        }
        for (StockTransferItem line : transferItemRepository.findByTransferId(id)) {
            InventoryItem item = itemRepository.findByProductIdAndWarehouseId(
                    line.getProduct().getId(), transfer.getSourceWarehouse().getId()).orElseThrow(
                    () -> new IllegalStateException("No stock record for " + line.getProduct().getName() + " at source warehouse"));
            if (item.getAvailableQuantity() < line.getQuantity()) {
                throw new IllegalStateException("Insufficient available stock for " + line.getProduct().getName());
            }
            item.setQuantity(item.getQuantity() - line.getQuantity());
            item.setInTransitQuantity(item.getInTransitQuantity() + line.getQuantity());
            itemRepository.save(item);
            logTransaction(line.getProduct(), transfer.getSourceWarehouse(), transfer.getDestinationWarehouse(),
                    "TRANSFER", line.getQuantity(), transfer.getTransferNumber(), "STOCK_TRANSFER", transfer.getId());
        }
        transfer.setStatus("IN_TRANSIT");
        return transferRepository.save(transfer);
    }

    /** Lands the in-transit stock at the destination warehouse. */
    @Transactional
    public StockTransfer receive(Long id) {
        StockTransfer transfer = get(id);
        if (!"IN_TRANSIT".equals(transfer.getStatus())) {
            throw new IllegalStateException("Only an IN_TRANSIT transfer can be received");
        }
        for (StockTransferItem line : transferItemRepository.findByTransferId(id)) {
            InventoryItem sourceItem = itemRepository.findByProductIdAndWarehouseId(
                    line.getProduct().getId(), transfer.getSourceWarehouse().getId()).orElseThrow();
            sourceItem.setInTransitQuantity(sourceItem.getInTransitQuantity() - line.getQuantity());
            itemRepository.save(sourceItem);

            Optional<InventoryItem> optDest = itemRepository.findByProductIdAndWarehouseId(
                    line.getProduct().getId(), transfer.getDestinationWarehouse().getId());
            InventoryItem destItem = optDest.orElseGet(() -> {
                InventoryItem newItem = new InventoryItem();
                newItem.setProduct(line.getProduct());
                newItem.setWarehouse(transfer.getDestinationWarehouse());
                return newItem;
            });
            destItem.setQuantity(destItem.getQuantity() + line.getQuantity());
            itemRepository.save(destItem);
        }
        transfer.setStatus("RECEIVED");
        return transferRepository.save(transfer);
    }

    private void logTransaction(Product product, Warehouse source, Warehouse destination, String type,
                                 int quantity, String reference, String referenceType, Long referenceId) {
        InventoryTransaction tx = new InventoryTransaction();
        tx.setProduct(product);
        tx.setSourceWarehouse(source);
        tx.setDestinationWarehouse(destination);
        tx.setType(type);
        tx.setQuantity(quantity);
        tx.setDate(LocalDateTime.now());
        tx.setReference(reference);
        tx.setReferenceType(referenceType);
        tx.setReferenceId(referenceId);
        transactionRepository.save(tx);
    }
}
