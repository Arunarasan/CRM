package com.arudra.crm.repository;

import com.arudra.crm.entity.UserDeviceEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserDeviceEventRepository extends JpaRepository<UserDeviceEvent, Long> {

    List<UserDeviceEvent> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);

    List<UserDeviceEvent> findByDeviceIdOrderByCreatedAtDesc(Long deviceId);
}
