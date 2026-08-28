package com.arudra.crm.repository;

import com.arudra.crm.entity.ContentBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContentBlockRepository extends JpaRepository<ContentBlock, Long> {
    List<ContentBlock> findByIsDeletedFalseOrderByPageAscDisplayOrderAscIdAsc();
    List<ContentBlock> findByPageAndActiveTrueAndIsDeletedFalseOrderByDisplayOrderAscIdAsc(String page);
    Optional<ContentBlock> findByIdAndIsDeletedFalse(Long id);
    Optional<ContentBlock> findByPageAndSectionKeyAndIsDeletedFalse(String page, String sectionKey);
    long countByIsDeletedFalse();
}
