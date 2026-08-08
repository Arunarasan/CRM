package com.arudra.crm.dto.lead;

import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/** One Kanban column: a pipeline bucket with its leads and aggregates. */
@Data
public class LeadBoardColumnDTO {
    private String key;
    private long count;
    private BigDecimal totalValue = BigDecimal.ZERO;
    private List<LeadCardDTO> leads = new ArrayList<>();
}
