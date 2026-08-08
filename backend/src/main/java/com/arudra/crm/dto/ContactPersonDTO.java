package com.arudra.crm.dto;

import lombok.Data;

@Data
public class ContactPersonDTO {
    private Long id;
    private String name;
    private String designation;
    private String phone;
    private String email;
    private Boolean isPrimary;
    private String whatsapp;
    private String notes;
}
