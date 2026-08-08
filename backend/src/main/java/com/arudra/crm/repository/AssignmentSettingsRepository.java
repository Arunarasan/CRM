package com.arudra.crm.repository;

import com.arudra.crm.entity.AssignmentSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AssignmentSettingsRepository extends JpaRepository<AssignmentSettings, Long> {
}
