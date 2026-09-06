package com.arudra.crm.repository;

import com.arudra.crm.entity.CompanyTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface CompanyTransactionRepository extends JpaRepository<CompanyTransaction, Long> {

    Page<CompanyTransaction> findByIsDeletedFalseOrderByTxnDateDescIdDesc(Pageable pageable);

    /** All live rows of one direction within a date window — feeds the Cash Book and reports. */
    List<CompanyTransaction> findByDirectionAndTxnDateBetweenAndIsDeletedFalse(
            String direction, LocalDate from, LocalDate to);

    /** Payment history recorded against one recurring expense head. */
    List<CompanyTransaction> findByRecurringExpenseIdAndIsDeletedFalseOrderByTxnDateDescIdDesc(Long recurringExpenseId);

    @Query("select t from CompanyTransaction t where t.isDeleted = false " +
           "and (:direction is null or t.direction = :direction) " +
           "and (:category is null or t.category = :category) " +
           "and (:from is null or t.txnDate >= :from) " +
           "and (:to is null or t.txnDate <= :to) " +
           "and (:q is null or lower(t.partyName) like lower(concat('%', :q, '%')) " +
           "     or lower(t.description) like lower(concat('%', :q, '%')) " +
           "     or lower(t.txnNumber) like lower(concat('%', :q, '%'))) " +
           "order by t.txnDate desc, t.id desc")
    Page<CompanyTransaction> search(@Param("direction") String direction,
                                    @Param("category") String category,
                                    @Param("from") LocalDate from,
                                    @Param("to") LocalDate to,
                                    @Param("q") String q,
                                    Pageable pageable);

    @Query("select t.category, coalesce(sum(t.amount), 0) from CompanyTransaction t " +
           "where t.direction = :direction and t.txnDate between :from and :to and t.isDeleted = false " +
           "group by t.category")
    List<Object[]> totalsByCategoryBetween(@Param("direction") String direction,
                                           @Param("from") LocalDate from,
                                           @Param("to") LocalDate to);

    @Query("select coalesce(sum(t.amount), 0) from CompanyTransaction t " +
           "where t.direction = :direction and t.txnDate between :from and :to and t.isDeleted = false")
    BigDecimal totalBetween(@Param("direction") String direction,
                            @Param("from") LocalDate from,
                            @Param("to") LocalDate to);
}
