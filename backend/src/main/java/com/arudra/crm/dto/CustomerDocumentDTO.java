package com.arudra.crm.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CustomerDocumentDTO {
    private Long id;
    private String fileName;
    private String fileUrl;
    private String fileType;
    private String uploadedByName;
    private LocalDateTime createdAt;
}
