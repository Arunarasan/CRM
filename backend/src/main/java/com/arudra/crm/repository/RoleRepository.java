package com.arudra.crm.repository;

import com.arudra.crm.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Repository
public interface RoleRepository extends JpaRepository<Role, Long> {
    Optional<Role> findByName(String name);

    /**
     * Direct join-table insert for seeding role-permission links, deliberately bypassing
     * entity save/merge — some rows in this dev database have an inconsistent/NULL @Version
     * column (predating version tracking), which makes Hibernate's optimistic-lock checks on
     * Role.save() fail with StaleObjectStateException. A plain idempotent SQL insert sidesteps
     * entity versioning entirely.
     */
    @Modifying
    @Transactional
    @Query(value = "INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (:roleId, :permissionId)", nativeQuery = true)
    void assignPermission(@Param("roleId") Long roleId, @Param("permissionId") Long permissionId);
}
