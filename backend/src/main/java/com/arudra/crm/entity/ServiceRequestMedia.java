package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "service_request_media")
@Getter
@Setter
public class ServiceRequestMedia extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "service_request_id")
    private ServiceRequest serviceRequest;

    @Column(nullable = false, length = 500)
    private String url;

    @Column(name = "media_type", length = 50)
    private String mediaType;
}
