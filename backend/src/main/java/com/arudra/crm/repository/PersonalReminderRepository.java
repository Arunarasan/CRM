package com.arudra.crm.repository;

import com.arudra.crm.entity.PersonalReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PersonalReminderRepository extends JpaRepository<PersonalReminder, Long> {
    List<PersonalReminder> findByOwnerIdAndIsDeletedFalseOrderByStatusAscDueDateAscIdDesc(Long ownerId);
}
