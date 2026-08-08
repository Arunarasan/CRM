package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "site_rooms")
public class SiteRoom extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_visit_id", nullable = false)
    private SiteVisit siteVisit;

    @Column(name = "room_name", nullable = false, length = 100)
    private String roomName;

    @OneToMany(mappedBy = "siteRoom", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SiteMeasurement> measurements = new ArrayList<>();
}
