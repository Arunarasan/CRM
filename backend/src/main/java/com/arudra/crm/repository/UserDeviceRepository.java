package com.arudra.crm.repository;

import com.arudra.crm.entity.UserDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserDeviceRepository extends JpaRepository<UserDevice, Long> {

    List<UserDevice> findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(Long userId);

    List<UserDevice> findByUserIdAndStatusAndIsDeletedFalse(Long userId, String status);

    List<UserDevice> findByUserIdAndStatusInAndIsDeletedFalse(Long userId, Collection<String> statuses);

    Optional<UserDevice> findByUserIdAndDeviceUuidAndIsDeletedFalse(Long userId, String deviceUuid);

    /** Includes soft-deleted (reset) rows — the (user_id, device_uuid) unique key spans them too. */
    Optional<UserDevice> findByUserIdAndDeviceUuid(Long userId, String deviceUuid);

    boolean existsByUserIdAndIsDeletedFalse(Long userId);

    long countByUserIdAndStatusAndIsDeletedFalse(Long userId, String status);

    List<UserDevice> findByStatusAndIsDeletedFalseOrderByRequestedAtAsc(String status);

    /** Same phone (by uuid or key) live under another user = shared-device attempt. */
    List<UserDevice> findByDeviceUuidAndUserIdNotAndStatusInAndIsDeletedFalse(String deviceUuid, Long userId, Collection<String> statuses);

    List<UserDevice> findByPublicKeyHashAndUserIdNotAndStatusInAndIsDeletedFalse(String publicKeyHash, Long userId, Collection<String> statuses);
}
