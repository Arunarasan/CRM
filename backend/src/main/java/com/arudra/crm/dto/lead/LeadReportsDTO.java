package com.arudra.crm.dto.lead;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/** Container for all lead analytics blocks consumed by the reports UI. */
@Data
public class LeadReportsDTO {

    private List<SourceAnalysis> sourceAnalysis;
    private List<EmployeePerformance> employeePerformance;
    private List<MonthlyLeads> monthlyLeads;
    private List<LostReason> lostReasons;
    private List<ForecastRow> revenueForecast;
    private Double averageSalesCycleDays;
    private double conversionRate;
    private BigDecimal totalPipelineValue;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SourceAnalysis {
        private String source;
        private long total;
        private long converted;
        private long lost;
        private BigDecimal totalValue;
        private double conversionRate;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmployeePerformance {
        private Long userId;
        private String name;
        private long total;
        private long converted;
        private long lost;
        private BigDecimal totalValue;
        private double conversionRate;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthlyLeads {
        private String month;
        private long total;
        private long converted;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LostReason {
        private String reason;
        private long count;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ForecastRow {
        private String status;
        private long count;
        private BigDecimal expectedValue;
        private BigDecimal weightedValue;
    }
}
