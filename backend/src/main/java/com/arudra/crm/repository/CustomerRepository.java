package com.arudra.crm.repository;

import com.arudra.crm.entity.Customer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long>, JpaSpecificationExecutor<Customer> {
    
    @Query("SELECT c FROM Customer c WHERE " +
           "LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.phone) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.email) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Customer> searchCustomers(@Param("search") String search, Pageable pageable);

    Page<Customer> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Match an existing customer for website guest checkout (email first, then phone). */
    java.util.Optional<Customer> findFirstByEmailIgnoreCaseAndIsDeletedFalseOrderByIdAsc(String email);
    java.util.Optional<Customer> findFirstByPhoneAndIsDeletedFalseOrderByIdAsc(String phone);
}
