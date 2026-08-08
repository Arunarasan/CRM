package com.arudra.crm.dto;

import lombok.Data;

@Data
public class CustomerAddressDTO {
    private Long id;
    private String label;
    private String address;
    private String city;
    private String state;
    private String pincode;
    private Boolean isPrimary;
}
