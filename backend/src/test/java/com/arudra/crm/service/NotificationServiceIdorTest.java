package com.arudra.crm.service;

import com.arudra.crm.entity.Notification;
import com.arudra.crm.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression guard for the notification IDOR fix: markAsRead must only mark a notification read
 * for its own recipient, never for another user's id.
 */
@ExtendWith(MockitoExtension.class)
class NotificationServiceIdorTest {

    @Mock private NotificationRepository notificationRepository;
    @InjectMocks private NotificationService service;

    @Test
    void markAsRead_deniesWhenNotificationBelongsToAnotherUser() {
        Notification other = new Notification();
        other.setId(1L);
        other.setRecipientId(99L);          // owned by user 99
        when(notificationRepository.findById(1L)).thenReturn(Optional.of(other));

        assertThrows(AccessDeniedException.class, () -> service.markAsRead(1L, 5L));
        verify(notificationRepository, never()).save(any());
    }

    @Test
    void markAsRead_succeedsForOwner() {
        Notification mine = new Notification();
        mine.setId(2L);
        mine.setRecipientId(5L);
        when(notificationRepository.findById(2L)).thenReturn(Optional.of(mine));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(inv -> inv.getArgument(0));

        Notification result = service.markAsRead(2L, 5L);

        assertTrue(result.isRead());
        verify(notificationRepository).save(mine);
    }
}
