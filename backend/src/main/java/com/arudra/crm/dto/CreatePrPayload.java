package com.arudra.crm.dto;

import java.util.List;

public class CreatePrPayload {
    public Long projectId;
    public Long boqId;
    public Long warehouseId;
    public String priority;       // LOW, MEDIUM, HIGH, URGENT
    public String requiredDate;   // ISO yyyy-MM-dd
    public String reason;
    public String source;         // PROJECT_MANAGER, SITE_ENGINEER, STORE_KEEPER, EMPLOYEE_REQUEST, INVENTORY
    public Integer approvalLevels; // default 1
    public List<CreatePrItem> items;
}
