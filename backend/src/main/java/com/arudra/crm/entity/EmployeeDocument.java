package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "employee_documents")
public class EmployeeDocument extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(name = "document_name", nullable = false, length = 150)
    private String documentName;

    @Column(name = "document_type", nullable = false, length = 50)
    private String documentType; // AADHAAR, PAN, OFFER_LETTER, EXPERIENCE_LETTER

    @Column(name = "file_url", nullable = false, length = 500)
    private String fileUrl;

    @Column(name = "uploaded_date")
    private LocalDate uploadedDate = LocalDate.now();
}
