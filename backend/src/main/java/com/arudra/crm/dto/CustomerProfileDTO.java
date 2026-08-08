package com.arudra.crm.dto;

import lombok.Data;
import java.util.List;

@Data
public class CustomerProfileDTO {
    private Long id;
    private String name;
    private String phone;
    private String email;
    private String billingAddress;
    private String siteAddress;
    private String city;
    private String district;
    private String state;
    private String country;
    private String pincode;
    private String googleMapLocation;
    private Double latitude;
    private Double longitude;
    private String gstNumber;
    private String customerCode;
    private String customerType;
    private String companyName;
    private String contactPersonName;
    private String alternatePhone;
    private String whatsappNumber;
    private String website;
    private String panNumber;
    private java.time.LocalDate customerSince;
    private String status;
    private String photoUrl;
    private String preferredLanguage;
    private String preferredContactMethod;

    private Integer totalProjects;
    private Integer runningProjects;
    private Integer completedProjects;
    private Integer cancelledProjects;
    private Integer upcomingProjects;
    private java.math.BigDecimal projectValue;
    private java.time.LocalDate lastProjectDate;
    
    private java.math.BigDecimal totalQuotationValue;
    private java.math.BigDecimal totalInvoiceAmount;
    private java.math.BigDecimal totalPaid;
    private java.math.BigDecimal outstandingAmount;
    private java.math.BigDecimal advancePaid;
    private java.time.LocalDate lastPaymentDate;
    private java.math.BigDecimal creditLimit;
    private String paymentTerms;
    
    private List<TagDTO> tags;
    private List<CustomerAddressDTO> addresses;
    private List<ContactPersonDTO> contacts;
    private List<CustomerNoteDTO> notes;
    private List<CustomerDocumentDTO> documents;
    private List<CustomerActivityDTO> timeline;

    private List<ProjectMiniDTO> projects;
    private List<QuotationMiniDTO> quotations;
    private List<InvoiceMiniDTO> invoices;
    private List<PaymentMiniDTO> payments;
    private List<LeadMiniDTO> leads;
    private List<SiteVisitMiniDTO> siteVisits;
    private List<TaskMiniDTO> tasks;

    @Data public static class ProjectMiniDTO { private Long id; private String name; private String status; private java.time.LocalDate startDate; private java.time.LocalDate endDate; }
    @Data public static class QuotationMiniDTO { private Long id; private String quotationNumber; private String status; private java.math.BigDecimal totalAmount; private java.time.LocalDate issueDate; }
    @Data public static class InvoiceMiniDTO { private Long id; private String invoiceNumber; private String status; private java.math.BigDecimal grandTotal; private java.time.LocalDate issueDate; private java.time.LocalDate dueDate; }
    @Data public static class PaymentMiniDTO { private Long id; private String receiptNumber; private java.math.BigDecimal amount; private java.time.LocalDate paymentDate; private String paymentMethod; private String status; }
    @Data public static class LeadMiniDTO { private Long id; private String status; private java.time.LocalDateTime createdAt; private String leadSource; }
    @Data public static class SiteVisitMiniDTO { private Long id; private String status; private java.time.LocalDateTime scheduledTime; private String locationAddress; }
    @Data public static class TaskMiniDTO { private Long id; private String title; private String status; private String priority; private java.time.LocalDate dueDate; }

}