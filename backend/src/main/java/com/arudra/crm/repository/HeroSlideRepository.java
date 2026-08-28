package com.arudra.crm.repository;

import com.arudra.crm.entity.HeroSlide;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface HeroSlideRepository extends JpaRepository<HeroSlide, Long> {
    List<HeroSlide> findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc();

    // ---- Admin (CMS) ----
    List<HeroSlide> findByIsDeletedFalseOrderByDisplayOrderAsc();
    Optional<HeroSlide> findByIdAndIsDeletedFalse(Long id);
}
