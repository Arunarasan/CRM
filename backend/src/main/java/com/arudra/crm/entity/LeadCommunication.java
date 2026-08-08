package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@Entity
@Table(name = "lead_communications", indexes = {
    @Index(name = "idx_lead_comm_lead", columnList = "lead_id"),
    @Index(name = "idx_lead_comm_date", columnList = "communication_date")
})
public class LeadCommunication extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lead_id", nullable = false)
    private Lead lead;

    @Column(name = "communication_type", nullable = false, length = 50)
    private String communicationType; // Phone Call, WhatsApp, Email, Meeting, Office Visit, Site Visit, SMS, Video Call

    @Column(length = 20)
    private String direction; // Incoming, Outgoing

    @Column(name = "communication_date", nullable = false)
    private LocalDate communicationDate;

    @Column(name = "communication_time")
    private LocalTime communicationTime;

    @Column(length = 255)
    private String summary;

    @Column(name = "detailed_notes", columnDefinition = "TEXT")
    private String detailedNotes;

    @Column(name = "attachment_url", length = 500)
    private String attachmentUrl;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performed_by_id")
    private User performedBy;
}
