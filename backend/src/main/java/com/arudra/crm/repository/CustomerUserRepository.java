package com.arudra.crm.repository;

import com.arudra.crm.entity.CustomerUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerUserRepository extends JpaRepository<CustomerUser, Long> {
    List<CustomerUser> findByUser_IdAndIsDeletedFalse(Long userId);
    Optional<CustomerUser> findByUser_IdAndCustomer_IdAndIsDeletedFalse(Long userId, Long customerId);
    List<CustomerUser> findByCustomer_IdAndIsDeletedFalse(Long customerId);
    boolean existsByUser_IdAndCustomer_Id(Long userId, Long customerId);
}
