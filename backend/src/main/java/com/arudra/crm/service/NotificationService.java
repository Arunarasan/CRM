package com.arudra.crm.service;

import com.arudra.crm.entity.Notification;
import com.arudra.crm.entity.NotificationSettings;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.NotificationRepository;
import com.arudra.crm.repository.NotificationSettingsRepository;
import com.arudra.crm.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Service
public class NotificationService {

    /** Roles that should receive company-wide management alerts (new lead, task completed, etc.). */
    public static final List<String> ADMIN_ALERT_ROLES = List.of("ROLE_ADMIN");

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private NotificationSettingsRepository settingsRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Central Dispatcher for all notifications
     */
    public void dispatch(String title, String message, String type, Long recipientId, String actionUrl) {
        
        // 1. Fetch user's routing preferences
        NotificationSettings settings = getSettings(recipientId);

        // 2. In-App Notification Routing
        if (settings.isInAppEnabled()) {
            Notification notification = new Notification();
            notification.setTitle(title);
            notification.setMessage(message);
            notification.setType(type);
            notification.setRecipientId(recipientId);
            notification.setActionUrl(actionUrl);
            notificationRepository.save(notification);
        }

        // 3. External API Routing (Mocked)
        if (settings.isEmailEnabled()) {
            System.out.println("[EMAIL DISPATCHER] To: User " + recipientId + " | Subject: " + title + " | Body: " + message);
        }
        
        if (settings.isSmsEnabled()) {
            System.out.println("[SMS DISPATCHER] To: User " + recipientId + " | Msg: " + title + " - " + message);
        }
        
        if (settings.isWhatsappEnabled()) {
            System.out.println("[WHATSAPP DISPATCHER] To: User " + recipientId + " | Msg: *" + title + "* \n" + message);
        }
    }

    /**
     * Dispatches the same notification to every user holding one of the given roles, skipping the
     * actor who triggered the event (so people don't get notified about their own action). Used to
     * route company-wide events (a new lead, a completed task, a raised request) to admins/managers
     * without every caller re-implementing the role lookup.
     */
    public void dispatchToRoles(Collection<String> roleNames, String title, String message,
                                String type, String actionUrl, Long excludeUserId) {
        for (User u : userRepository.findByRoleNames(new java.util.ArrayList<>(roleNames))) {
            if (u.getId() == null || u.getId().equals(excludeUserId)) continue;
            dispatch(title, message, type, u.getId(), actionUrl);
        }
    }

    /** Convenience: notify all admins about a management-visible event. */
    public void dispatchToAdmins(String title, String message, String type, String actionUrl, Long excludeUserId) {
        dispatchToRoles(ADMIN_ALERT_ROLES, title, message, type, actionUrl, excludeUserId);
    }

    /**
     * Dispatch only if the recipient doesn't already have an identical UNREAD notification.
     * Used by the daily reminder schedulers so re-running the same reminder (overdue invoice,
     * follow-up due, low stock…) each day doesn't pile up duplicates — one stays until acted on.
     */
    public void dispatchIfAbsent(String title, String message, String type, Long recipientId, String actionUrl) {
        if (recipientId != null
                && notificationRepository.existsByRecipientIdAndMessageAndIsReadFalse(recipientId, message)) {
            return;
        }
        dispatch(title, message, type, recipientId, actionUrl);
    }

    // --- Cleanup (all scoped to the calling user) ---

    /** Deletes one notification, but only if it belongs to the requesting user. */
    @Transactional
    public void delete(Long notificationId, Long requesterId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (n.getRecipientId() != null && n.getRecipientId().equals(requesterId)) {
                notificationRepository.delete(n);
            }
        });
    }

    /** Deletes every notification for the user. */
    @Transactional
    public void clearAll(Long recipientId) {
        notificationRepository.deleteByRecipientId(recipientId);
    }

    /** Deletes only the already-read notifications for the user. */
    @Transactional
    public void clearRead(Long recipientId) {
        notificationRepository.deleteByRecipientIdAndIsReadTrue(recipientId);
    }

    // --- Core Operations ---

    public Page<Notification> getInbox(Long recipientId, int page, int size) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(recipientId, PageRequest.of(page, size));
    }

    public List<Notification> getRecent(Long recipientId) {
        return notificationRepository.findTop5ByRecipientIdOrderByCreatedAtDesc(recipientId);
    }

    public long getUnreadCount(Long recipientId) {
        return notificationRepository.countByRecipientIdAndIsReadFalse(recipientId);
    }

    /** Marks one notification read, but only if it belongs to the requesting user. */
    @Transactional
    public Notification markAsRead(Long notificationId, Long requesterId) {
        Notification notif = notificationRepository.findById(notificationId).orElseThrow();
        if (notif.getRecipientId() == null || !notif.getRecipientId().equals(requesterId)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Notification does not belong to the current user");
        }
        notif.setRead(true);
        return notificationRepository.save(notif);
    }

    @Transactional
    public void markAllAsRead(Long recipientId) {
        List<Notification> unread = notificationRepository.findByRecipientIdAndIsReadFalse(recipientId);
        for (Notification n : unread) {
            n.setRead(true);
        }
        notificationRepository.saveAll(unread);
    }

    // --- Settings ---
    
    public NotificationSettings getSettings(Long userId) {
        return settingsRepository.findByUserId(userId).orElseGet(() -> {
            NotificationSettings newSettings = new NotificationSettings();
            newSettings.setUserId(userId);
            return settingsRepository.save(newSettings);
        });
    }

    public NotificationSettings updateSettings(NotificationSettings updated) {
        Optional<NotificationSettings> existing = settingsRepository.findByUserId(updated.getUserId());
        if (existing.isPresent()) {
            NotificationSettings s = existing.get();
            s.setEmailEnabled(updated.isEmailEnabled());
            s.setSmsEnabled(updated.isSmsEnabled());
            s.setWhatsappEnabled(updated.isWhatsappEnabled());
            s.setInAppEnabled(updated.isInAppEnabled());
            return settingsRepository.save(s);
        }
        return settingsRepository.save(updated);
    }
}
