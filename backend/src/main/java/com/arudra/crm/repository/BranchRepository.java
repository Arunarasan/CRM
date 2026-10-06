package com.arudra.crm.repository;

import com.arudra.crm.entity.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BranchRepository extends JpaRepository<Branch, Long> {
    List<Branch> findByIsDeletedFalseOrderByNameAsc();

    List<Branch> findByActiveTrueAndIsDeletedFalseOrderByNameAsc();
}
