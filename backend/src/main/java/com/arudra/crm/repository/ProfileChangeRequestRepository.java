package com.arudra.crm.repository;

import com.arudra.crm.entity.ProfileChangeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProfileChangeRequestRepository extends JpaRepository<ProfileChangeRequest, Long> {

    /** All requests for one employee, latest first — portal "my requests" + admin inline panel. */
    List<ProfileChangeRequest> findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(Long employeeId);

    /** The admin review queue filtered by status (e.g. PENDING), latest first. */
    List<ProfileChangeRequest> findByStatusAndIsDeletedFalseOrderByIdDesc(String status);

    /** The whole admin review queue, latest first. */
    List<ProfileChangeRequest> findByIsDeletedFalseOrderByIdDesc();
}
