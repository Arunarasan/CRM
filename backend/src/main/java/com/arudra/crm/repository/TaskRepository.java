package com.arudra.crm.repository;

import com.arudra.crm.entity.Task;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    long countByStatus(String status);
    
    @Query("SELECT t FROM Task t WHERE " +
           "LOWER(t.taskName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(t.project.projectName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(t.status) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Task> searchTasks(@Param("search") String search, Pageable pageable);

    @Query("SELECT t FROM Task t WHERE t.dueDate = :today AND t.status != 'COMPLETED'")
    java.util.List<Task> findTasksDueToday(@Param("today") java.time.LocalDate today);
    java.util.List<com.arudra.crm.entity.Task> findByProjectCustomerIdOrderByDueDateAsc(Long customerId);
    Page<com.arudra.crm.entity.Task> findByProjectCustomerIdOrderByDueDateAsc(Long customerId, Pageable pageable);

    java.util.List<com.arudra.crm.entity.Task> findByProjectId(Long projectId);
    boolean existsByGeneratedFromBoqItemId(Long boqItemId);
    java.util.Optional<com.arudra.crm.entity.Task> findByGeneratedFromBoqItemId(Long boqItemId);
    long countByStatusNot(String status);
}