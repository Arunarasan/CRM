package com.arudra.crm.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CustomerNoteDTO {
    private Long id;
    private String noteType;
    private String content;
    private String authorName;
    private LocalDateTime createdAt;
}
