package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_media")
public class MeasurementMedia extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_id")
    private Measurement measurement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_room_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private MeasurementRoom measurementRoom;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "file_path", columnDefinition = "TEXT")
    private String filePath;

    @Column(name = "media_type", length = 50)
    private String mediaType; // Image, Video, PDF, Audio

    @Column(length = 50)
    private String category; // Before Photo, Room Photo, Measurement Photo, Video, Voice Note

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User uploadedBy;

    @Column(columnDefinition = "TEXT")
    private String description;
}
