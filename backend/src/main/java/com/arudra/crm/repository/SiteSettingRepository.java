package com.arudra.crm.repository;

import com.arudra.crm.entity.SiteSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SiteSettingRepository extends JpaRepository<SiteSetting, Long> {
    List<SiteSetting> findByIsDeletedFalseOrderByDisplayOrderAscIdAsc();
    Optional<SiteSetting> findBySettingKeyAndIsDeletedFalse(String settingKey);
    long countByIsDeletedFalse();
}
