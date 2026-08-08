package com.arudra.crm.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ReportService {

    @PersistenceContext
    private EntityManager entityManager;

    public Map<String, Object> getDashboardMetrics(LocalDate startDate, LocalDate endDate) {
        Map<String, Object> metrics = new HashMap<>();

        // 1. Revenue (Sum of CustomerPayments in range)
        BigDecimal revenue = getSum("CustomerPayment", "paymentDate", startDate, endDate);
        metrics.put("totalRevenue", revenue);

        // 2. Cost of Goods (Sum of PurchaseBills in range)
        BigDecimal cogs = getSum("PurchaseBill", "billDate", startDate, endDate);
        
        // 3. Payroll Expenses (Sum of SalaryRecords in range)
        BigDecimal payroll = getSum("SalaryRecord", "paymentDate", startDate, endDate);
        
        // 4. Overhead Expenses (Sum of Expenses in range)
        BigDecimal overhead = getSum("Expense", "date", startDate, endDate);
        
        BigDecimal totalExpenses = cogs.add(payroll).add(overhead);
        metrics.put("totalExpenses", totalExpenses);
        
        // 5. Net Profit
        metrics.put("netProfit", revenue.subtract(totalExpenses));

        // 6. Counts
        metrics.put("newCustomers", getCount("Customer", "createdAt", startDate, endDate, true));
        metrics.put("newProjects", getCount("Project", "startDate", startDate, endDate, false));
        metrics.put("invoicesGenerated", getCount("Invoice", "date", startDate, endDate, false));

        return metrics;
    }

    public List<Map<String, Object>> getSalesChartData(int year) {
        // Fetch monthly revenue for the given year
        String queryStr = "SELECT MONTH(cp.paymentDate) as month, SUM(cp.amount) as revenue " +
                          "FROM CustomerPayment cp WHERE YEAR(cp.paymentDate) = :year " +
                          "GROUP BY MONTH(cp.paymentDate) ORDER BY month";
        
        Query query = entityManager.createQuery(queryStr);
        query.setParameter("year", year);
        List<Object[]> results = query.getResultList();
        
        return results.stream().map(row -> {
            Map<String, Object> map = new HashMap<>();
            map.put("month", row[0]);
            map.put("revenue", row[1]);
            return map;
        }).collect(Collectors.toList());
    }

    public Map<String, Long> getLeadConversionStats() {
        String queryStr = "SELECT l.status, COUNT(l) FROM Lead l GROUP BY l.status";
        Query query = entityManager.createQuery(queryStr);
        List<Object[]> results = query.getResultList();
        
        Map<String, Long> stats = new HashMap<>();
        for (Object[] result : results) {
            stats.put((String) result[0], (Long) result[1]);
        }
        return stats;
    }

    // Helpers
    private BigDecimal getSum(String entity, String dateField, LocalDate start, LocalDate end) {
        String amountField = "amount";
        if (entity.equals("PurchaseBill")) amountField = "totalAmount";
        if (entity.equals("SalaryRecord")) amountField = "netSalary";
        
        String jpql = "SELECT COALESCE(SUM(e." + amountField + "), 0) FROM " + entity + " e WHERE e." + dateField + " >= :start AND e." + dateField + " <= :end";
        Query query = entityManager.createQuery(jpql);
        query.setParameter("start", start);
        query.setParameter("end", end);
        
        try {
             return (BigDecimal) query.getSingleResult();
        } catch (Exception e) {
             return BigDecimal.ZERO;
        }
    }

    private Long getCount(String entityName, String dateField, LocalDate start, LocalDate end, boolean isLocalDateTime) {
        String jpql = "SELECT COUNT(e) FROM " + entityName + " e WHERE e." + dateField + " >= :start AND e." + dateField + " <= :end";
        Query query = entityManager.createQuery(jpql);
        
        if (isLocalDateTime) {
            query.setParameter("start", start.atStartOfDay());
            query.setParameter("end", end.plusDays(1).atStartOfDay().minusSeconds(1));
        } else {
            query.setParameter("start", start);
            query.setParameter("end", end);
        }
        
        try {
            return (Long) query.getSingleResult();
        } catch (Exception e) {
            return 0L;
        }
    }
}
