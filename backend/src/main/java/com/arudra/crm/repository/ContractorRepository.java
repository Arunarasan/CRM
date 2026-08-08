package com.arudra.crm.repository;

import com.arudra.crm.entity.Contractor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ContractorRepository extends JpaRepository<Contractor, Long> {

    @Query("SELECT c FROM Contractor c WHERE " +
           "LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.companyName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.skills) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Contractor> searchContractors(@Param("search") String search, Pageable pageable);

    /** Master list with the module's trade/status/rating filters applied server-side. */
    @Query("SELECT c FROM Contractor c WHERE " +
           "(:search IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "  OR LOWER(c.companyName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "  OR LOWER(c.contractorCode) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "  OR LOWER(c.phone) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND (:trade IS NULL OR c.trade = :trade OR c.trades LIKE CONCAT('%', :trade, '%')) " +
           "AND (:status IS NULL OR c.status = :status) " +
           "AND (:minRating IS NULL OR c.overallRating >= :minRating) " +
           "AND c.isDeleted = false")
    Page<Contractor> filter(@Param("search") String search,
                            @Param("trade") String trade,
                            @Param("status") String status,
                            @Param("minRating") java.math.BigDecimal minRating,
                            Pageable pageable);

    Optional<Contractor> findByContractorCode(String contractorCode);

    Optional<Contractor> findByUserId(Long userId);

    Optional<Contractor> findByWorkforceId(Long workforceId);

    boolean existsByContractorCode(String contractorCode);

    List<Contractor> findByStatusOrderByNameAsc(String status);

    List<Contractor> findByTradeAndStatusOrderByOverallRatingDesc(String trade, String status);

    /** Compliance widget: agreements/insurance/licences lapsing inside the alert window. */
    @Query("SELECT c FROM Contractor c WHERE c.isDeleted = false AND (" +
           "(c.agreementEndDate IS NOT NULL AND c.agreementEndDate <= :cutoff) OR " +
           "(c.insuranceExpiryDate IS NOT NULL AND c.insuranceExpiryDate <= :cutoff) OR " +
           "(c.licenseExpiryDate IS NOT NULL AND c.licenseExpiryDate <= :cutoff))")
    List<Contractor> findWithExpiringCompliance(@Param("cutoff") LocalDate cutoff);
}
