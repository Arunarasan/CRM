package com.arudra.crm.repository;

import com.arudra.crm.entity.DamageEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DamageEntryRepository extends JpaRepository<DamageEntry, Long> {
    List<DamageEntry> findAllByOrderByIdDesc();
}
