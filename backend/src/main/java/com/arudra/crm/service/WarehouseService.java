package com.arudra.crm.service;

import com.arudra.crm.entity.InventoryItem;
import com.arudra.crm.entity.Warehouse;
import com.arudra.crm.repository.InventoryItemRepository;
import com.arudra.crm.repository.WarehouseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class WarehouseService {

    @Autowired
    private WarehouseRepository warehouseRepository;

    @Autowired
    private InventoryItemRepository itemRepository;

    public List<Warehouse> getAll() {
        return warehouseRepository.findAll();
    }

    public Warehouse get(Long id) {
        return warehouseRepository.findById(id).orElseThrow();
    }

    public Warehouse create(Warehouse warehouse) {
        return warehouseRepository.save(warehouse);
    }

    public Warehouse update(Long id, Warehouse details) {
        Warehouse warehouse = get(id);
        warehouse.setName(details.getName());
        warehouse.setLocation(details.getLocation());
        warehouse.setManagerName(details.getManagerName());
        return warehouseRepository.save(warehouse);
    }

    public void delete(Long id) {
        List<InventoryItem> stock = itemRepository.findByWarehouseId(id);
        boolean hasStock = stock.stream().anyMatch(i ->
                i.getQuantity() != 0 || i.getReservedQuantity() != 0 || i.getDamagedQuantity() != 0 || i.getInTransitQuantity() != 0);
        if (hasStock) {
            throw new IllegalStateException("Cannot delete a warehouse that still holds stock; transfer or zero it out first.");
        }
        warehouseRepository.deleteById(id);
    }

    /** Available / reserved / damaged / in-transit totals for one warehouse, per the spec's warehouse dashboard fields. */
    public Map<String, Object> getStockSummary(Long id) {
        Warehouse warehouse = get(id);
        List<InventoryItem> items = itemRepository.findByWarehouseId(id);

        int available = items.stream().mapToInt(InventoryItem::getAvailableQuantity).sum();
        int reserved = items.stream().mapToInt(InventoryItem::getReservedQuantity).sum();
        int damaged = items.stream().mapToInt(InventoryItem::getDamagedQuantity).sum();
        int inTransit = items.stream().mapToInt(InventoryItem::getInTransitQuantity).sum();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("warehouseId", warehouse.getId());
        result.put("warehouseName", warehouse.getName());
        result.put("location", warehouse.getLocation());
        result.put("managerName", warehouse.getManagerName());
        result.put("availableStock", available);
        result.put("reservedStock", reserved);
        result.put("damagedStock", damaged);
        result.put("inTransitStock", inTransit);
        result.put("itemCount", items.size());
        return result;
    }
}
