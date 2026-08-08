package com.arudra.crm.repository;

import com.arudra.crm.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);

    @org.springframework.data.jpa.repository.Query(
            "SELECT DISTINCT u FROM User u JOIN u.roles r WHERE r.name IN :roleNames")
    List<User> findByRoleNames(@org.springframework.data.repository.query.Param("roleNames") List<String> roleNames);
}
