package com.arudra.crm.repository;

import com.arudra.crm.entity.Testimonial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TestimonialRepository extends JpaRepository<Testimonial, Long> {
    List<Testimonial> findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc();

    // ---- Admin (CMS) ----
    List<Testimonial> findByIsDeletedFalseOrderByDisplayOrderAsc();
    Optional<Testimonial> findByIdAndIsDeletedFalse(Long id);
}
