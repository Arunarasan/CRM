package com.arudra.crm.service;

import com.arudra.crm.entity.MeasurementItem;
import com.arudra.crm.entity.MeasurementRoom;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.BoqItemRepository;
import com.arudra.crm.repository.MeasurementItemRepository;
import com.arudra.crm.repository.MeasurementRoomRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/**
 * Keeps a BOQ's source measurement in step with item edits made on the pricing sheet, so measurement
 * and pricing behave as one list: adding, renaming, resizing, moving or deleting a measured item in the
 * BOQ does the same to its measurement item (creating the room on the measurement when needed).
 *
 * <p>Room-derived work lines (Floor Tiling, Wall Painting…) have no measurement item of their own and are
 * left alone. BoqService calls these after the pricing edit has committed; each runs in its own
 * transaction, and failures are logged there rather than surfaced.
 */
@Component
public class BoqMeasurementMirror {

    /** Plain snapshot of a BOQ item — no entities cross the transaction boundary. */
    public record ItemData(String floorName, String roomName, String category, String itemName,
                           BigDecimal length, BigDecimal width, BigDecimal height,
                           BigDecimal quantity, String unit, String description) {}

    /** Ids of the measurement room/item now linked to the BOQ item. */
    public record Link(Long roomId, Long itemId) {}

    private final MeasurementService measurementService;
    private final MeasurementRoomRepository roomRepository;
    private final MeasurementItemRepository itemRepository;
    private final BoqItemRepository boqItemRepository;

    public BoqMeasurementMirror(MeasurementService measurementService,
                                MeasurementRoomRepository roomRepository,
                                MeasurementItemRepository itemRepository,
                                BoqItemRepository boqItemRepository) {
        this.measurementService = measurementService;
        this.roomRepository = roomRepository;
        this.itemRepository = itemRepository;
        this.boqItemRepository = boqItemRepository;
    }

    /** Creates the measurement item for a BOQ line added on the pricing sheet. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Link added(Long measurementId, ItemData data, User currentUser) {
        MeasurementRoom room = findOrCreateRoom(measurementId, data.floorName(), data.roomName(), currentUser);
        MeasurementItem item = new MeasurementItem();
        apply(item, data);
        MeasurementItem saved = measurementService.addItem(measurementId, room.getId(), item, currentUser);
        return new Link(room.getId(), saved.getId());
    }

    /** Mirrors an edit; moves the item when its floor/room changed. Re-creates it if it was removed. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Link updated(Long measurementId, Long measurementItemId, ItemData data, User currentUser) {
        MeasurementItem existing = measurementItemId == null ? null : itemRepository.findById(measurementItemId).orElse(null);
        if (existing == null || !existing.getRoom().getMeasurement().getId().equals(measurementId)) {
            return added(measurementId, data, currentUser);
        }
        MeasurementRoom room = existing.getRoom();
        if (!sameRoom(room, data.floorName(), data.roomName())) {
            MeasurementRoom from = room;
            room = findOrCreateRoom(measurementId, data.floorName(), data.roomName(), currentUser);
            measurementService.moveItem(measurementId, existing.getId(), room.getId(), currentUser);
            removeIfBare(measurementId, from, currentUser);
        }
        MeasurementItem patch = new MeasurementItem();
        apply(patch, data);
        // Fields the pricing sheet doesn't edit keep their measured values.
        patch.setMaterial(existing.getMaterial());
        if (patch.getNotes() == null) patch.setNotes(existing.getNotes());
        measurementService.updateItem(measurementId, room.getId(), existing.getId(), patch, currentUser);
        return new Link(room.getId(), existing.getId());
    }

    /** Stores the measurement link on the BOQ item (runs after the pricing edit committed). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void link(Long boqItemId, Link link) {
        boqItemRepository.findById(boqItemId).ifPresent(item -> {
            item.setMeasurementRoomId(link.roomId());
            item.setMeasurementItemId(link.itemId());
            boqItemRepository.save(item);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deleted(Long measurementId, Long measurementItemId, User currentUser) {
        if (measurementItemId == null) return;
        itemRepository.findById(measurementItemId)
                .filter(mi -> mi.getRoom().getMeasurement().getId().equals(measurementId))
                .ifPresent(mi -> {
                    MeasurementRoom room = mi.getRoom();
                    measurementService.deleteItem(measurementId, room.getId(), mi.getId(), currentUser);
                    removeIfBare(measurementId, room, currentUser);
                });
    }

    /**
     * Drops a room the pricing sheet emptied — but only a bare one (no items, no measured size, no scope
     * ticked). A room someone actually measured stays, even when its last item moved elsewhere.
     */
    private void removeIfBare(Long measurementId, MeasurementRoom room, User currentUser) {
        if (MeasurementService.DRAFT_ROOM_TYPE.equals(room.getRoomType())) return; // handled by moveItem
        if (!itemRepository.findByRoomId(room.getId()).isEmpty()) return;
        if (room.getLength() != null || room.getWidth() != null) return;
        if (Boolean.TRUE.equals(room.getFlooringRequired()) || Boolean.TRUE.equals(room.getPaintingRequired())
                || Boolean.TRUE.equals(room.getFalseCeilingRequired()) || Boolean.TRUE.equals(room.getWardrobeRequired())
                || Boolean.TRUE.equals(room.getKitchenRequired()) || Boolean.TRUE.equals(room.getTvUnitRequired())) return;
        measurementService.deleteRoom(measurementId, room.getId(), currentUser);
    }

    // ---------------------------------------------------------------------

    private void apply(MeasurementItem item, ItemData d) {
        item.setItemType(d.category() != null && !d.category().isBlank() ? d.category() : "Custom");
        item.setItemName(d.itemName());
        item.setLength(toDouble(d.length()));
        item.setWidth(toDouble(d.width()));
        item.setHeight(toDouble(d.height()));
        // Measurement quantities are whole counts; the exact (possibly fractional) qty lives on the BOQ.
        item.setQuantity(d.quantity() == null ? 1
                : Math.max(1, d.quantity().setScale(0, RoundingMode.HALF_UP).intValue()));
        item.setUnit(d.unit());
        item.setNotes(d.description());
    }

    private MeasurementRoom findOrCreateRoom(Long measurementId, String floorName, String roomName, User currentUser) {
        String name = roomName != null && !roomName.isBlank() ? roomName.trim() : "General";
        for (MeasurementRoom r : roomRepository.findByMeasurementId(measurementId)) {
            if (MeasurementService.DRAFT_ROOM_TYPE.equals(r.getRoomType())) continue;
            if (sameRoom(r, floorName, name)) return r;
        }
        MeasurementRoom room = new MeasurementRoom();
        room.setRoomName(name);
        room.setRoomType(name);
        room.setFloorNumber(floorName != null && !floorName.isBlank() ? floorName.trim() : null);
        return measurementService.addRoomToMeasurement(measurementId, room, currentUser);
    }

    private static boolean sameRoom(MeasurementRoom room, String floorName, String roomName) {
        return eq(room.getRoomName(), roomName) && eq(room.getFloorNumber(), floorName);
    }

    /** Case/space-insensitive; blank and null are the same ("no floor"). */
    private static boolean eq(String a, String b) {
        String x = a == null ? "" : a.trim().toLowerCase();
        String y = b == null ? "" : b.trim().toLowerCase();
        return Objects.equals(x, y);
    }

    private static Double toDouble(BigDecimal v) {
        return v == null ? null : v.doubleValue();
    }
}
