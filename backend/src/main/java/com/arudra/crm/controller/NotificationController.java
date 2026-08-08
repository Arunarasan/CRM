package com.arudra.crm.controller;

import com.arudra.crm.entity.Notification;
import com.arudra.crm.entity.NotificationSettings;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@CrossOrigin(origins = "*")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private CurrentUserService currentUserService;

    private Long currentUserId() {
        com.arudra.crm.entity.User user = currentUserService.getCurrentUser();
        if (user == null) {
            throw new RuntimeException("Unauthenticated");
        }
        return user.getId();
    }

    @GetMapping
    public ResponseEntity<Page<Notification>> getInbox(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(notificationService.getInbox(currentUserId(), page, size));
    }

    @GetMapping("/recent")
    public ResponseEntity<List<Notification>> getRecent() {
        return ResponseEntity.ok(notificationService.getRecent(currentUserId()));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Long> getUnreadCount() {
        return ResponseEntity.ok(notificationService.getUnreadCount(currentUserId()));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<Notification> markAsRead(@PathVariable Long id) {
        return ResponseEntity.ok(notificationService.markAsRead(id));
    }

    @PostMapping("/mark-all-read")
    public ResponseEntity<Void> markAllAsRead() {
        notificationService.markAllAsRead(currentUserId());
        return ResponseEntity.ok().build();
    }

    /** Delete one of my notifications. */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        notificationService.delete(id, currentUserId());
        return ResponseEntity.ok().build();
    }

    /** Clear my notifications — all of them, or just the already-read ones with ?onlyRead=true. */
    @DeleteMapping
    public ResponseEntity<Void> clear(@RequestParam(defaultValue = "false") boolean onlyRead) {
        if (onlyRead) {
            notificationService.clearRead(currentUserId());
        } else {
            notificationService.clearAll(currentUserId());
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/settings")
    public ResponseEntity<NotificationSettings> getSettings() {
        return ResponseEntity.ok(notificationService.getSettings(currentUserId()));
    }

    @PutMapping("/settings")
    public ResponseEntity<NotificationSettings> updateSettings(@RequestBody NotificationSettings settings) {
        settings.setUserId(currentUserId());
        return ResponseEntity.ok(notificationService.updateSettings(settings));
    }
}
