package com.arudra.crm.dto;

import com.arudra.crm.entity.Customer;

public class CustomerMapper {
    public static CustomerDTO toDTO(Customer customer) {
        if (customer == null) return null;
        CustomerDTO dto = new CustomerDTO();
        dto.setId(customer.getId());
        dto.setName(customer.getName());
        dto.setEmail(customer.getEmail());
        dto.setPhone(customer.getPhone());
        dto.setBillingAddress(customer.getBillingAddress());
        dto.setSiteAddress(customer.getSiteAddress());
        dto.setCity(customer.getCity());
        dto.setDistrict(customer.getDistrict());
        dto.setState(customer.getState());
        dto.setCountry(customer.getCountry());
        dto.setPincode(customer.getPincode());
        dto.setGoogleMapLocation(customer.getGoogleMapLocation());
        dto.setLatitude(customer.getLatitude());
        dto.setLongitude(customer.getLongitude());
        dto.setGstNumber(customer.getGstNumber());
        dto.setCustomerCode(customer.getCustomerCode());
        dto.setCustomerType(customer.getCustomerType());
        dto.setCompanyName(customer.getCompanyName());
        dto.setContactPersonName(customer.getContactPersonName());
        dto.setAlternatePhone(customer.getAlternatePhone());
        dto.setWhatsappNumber(customer.getWhatsappNumber());
        dto.setWebsite(customer.getWebsite());
        dto.setPanNumber(customer.getPanNumber());
        dto.setCustomerSince(customer.getCustomerSince());
        dto.setStatus(customer.getStatus());
        dto.setPhotoUrl(customer.getPhotoUrl());
        dto.setPreferredLanguage(customer.getPreferredLanguage());
        dto.setPreferredContactMethod(customer.getPreferredContactMethod());
        return dto;
    }

    public static Customer toEntity(CustomerDTO dto) {
        if (dto == null) return null;
        Customer customer = new Customer();
        customer.setId(dto.getId());
        customer.setName(dto.getName());
        customer.setEmail(dto.getEmail());
        customer.setPhone(dto.getPhone());
        customer.setBillingAddress(dto.getBillingAddress());
        customer.setSiteAddress(dto.getSiteAddress());
        customer.setCity(dto.getCity());
        customer.setDistrict(dto.getDistrict());
        customer.setState(dto.getState());
        customer.setCountry(dto.getCountry());
        customer.setPincode(dto.getPincode());
        customer.setGoogleMapLocation(dto.getGoogleMapLocation());
        customer.setLatitude(dto.getLatitude());
        customer.setLongitude(dto.getLongitude());
        customer.setGstNumber(dto.getGstNumber());
        customer.setCustomerCode(dto.getCustomerCode());
        customer.setCustomerType(dto.getCustomerType());
        customer.setCompanyName(dto.getCompanyName());
        customer.setContactPersonName(dto.getContactPersonName());
        customer.setAlternatePhone(dto.getAlternatePhone());
        customer.setWhatsappNumber(dto.getWhatsappNumber());
        customer.setWebsite(dto.getWebsite());
        customer.setPanNumber(dto.getPanNumber());
        customer.setCustomerSince(dto.getCustomerSince());
        customer.setPhotoUrl(dto.getPhotoUrl());
        customer.setPreferredLanguage(dto.getPreferredLanguage());
        customer.setPreferredContactMethod(dto.getPreferredContactMethod());
        if (dto.getStatus() != null) customer.setStatus(dto.getStatus());
        return customer;
    }
}
