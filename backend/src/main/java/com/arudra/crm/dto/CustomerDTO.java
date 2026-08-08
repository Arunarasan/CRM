package com.arudra.crm.dto;

import lombok.Data;

@Data
public class CustomerDTO {
    private Long id;
    private String name;
    private String email;
    private String phone;
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
    public String getCustomerCode() { return this.customerCode; }
    public void setCustomerCode(String code) { this.customerCode = code; }
}
