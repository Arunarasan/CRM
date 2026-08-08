package com.arudra.crm.repository;

import com.arudra.crm.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Page<Notification> findByRecipientIdOrderByCreatedAtDesc(Long recipientId, Pageable pageable);
    List<Notification> findTop5ByRecipientIdOrderByCreatedAtDesc(Long recipientId);
    long countByRecipientIdAndIsReadFalse(Long recipientId);
    List<Notification> findByRecipientIdAndIsReadFalse(Long recipientId);

    // Dedup guard for repeating reminders: is an identical alert already sitting unread?
    boolean existsByRecipientIdAndMessageAndIsReadFalse(Long recipientId, String message);

    // Cleanup / clear operations (all scoped to one recipient).
    void deleteByRecipientId(Long recipientId);
    void deleteByRecipientIdAndIsReadTrue(Long recipientId);
}
