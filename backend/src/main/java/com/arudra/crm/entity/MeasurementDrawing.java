package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_drawings")
public class MeasurementDrawing extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measurement_id", nullable = false)
    private Measurement measurement;

    @Column(name = "drawing_type", length = 100)
    private String drawingType; // Floor Plan, CAD File, PDF Drawing, Sketch, Blueprint, 3D Design,
                                // Room Sketch, Wall Sketch, Furniture Layout, Ceiling Layout, Electrical Layout, Plumbing Layout

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "file_path", columnDefinition = "TEXT")
    private String filePath;

    @Column(name = "file_type", length = 50)
    private String fileType; // pdf, dwg, jpg, png ...

    @Column(name = "file_size")
    private Long fileSize;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "roles"})
    private User uploadedBy;

    @Column(columnDefinition = "TEXT")
    private String description;
}
