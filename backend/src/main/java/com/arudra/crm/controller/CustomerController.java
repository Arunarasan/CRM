package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.dto.CustomerDTO;
import com.arudra.crm.dto.CustomerMapper;
import com.arudra.crm.entity.Customer;
import com.arudra.crm.service.CustomerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customers")
@CrossOrigin(origins = "*")
public class CustomerController {

    @Autowired
    private CustomerService customerService;

    @PreAuthorize("hasAnyRole('ADMIN', 'PROJECT_MANAGER', 'SALES')")
    @GetMapping
    public ResponseEntity<ApiResponse<Page<CustomerDTO>>> getCustomers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String tag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortField,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        Page<CustomerDTO> customers = customerService.getCustomersAdvanced(search, name, city, email, phone, tag, page, size, sortField, sortDir)
                .map(CustomerMapper::toDTO);
        return ResponseEntity.ok(ApiResponse.success(customers));
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_READ')")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<com.arudra.crm.dto.CustomerProfileDTO>> getCustomerById(@PathVariable Long id) {
        com.arudra.crm.dto.CustomerProfileDTO dto = customerService.getCustomerProfile(id);
        return ResponseEntity.ok(ApiResponse.success(dto));
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_WRITE')")
    @PostMapping
    public ResponseEntity<ApiResponse<CustomerDTO>> createCustomer(@RequestBody CustomerDTO customerDTO) {
        Customer customer = CustomerMapper.toEntity(customerDTO);
        Customer saved = customerService.createCustomer(customer);
        return ResponseEntity.ok(ApiResponse.success(CustomerMapper.toDTO(saved)));
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_WRITE')")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CustomerDTO>> updateCustomer(@PathVariable Long id, @RequestBody CustomerDTO customerDTO) {
        Customer customer = CustomerMapper.toEntity(customerDTO);
        Customer updated = customerService.updateCustomer(id, customer);
        return ResponseEntity.ok(ApiResponse.success(CustomerMapper.toDTO(updated)));
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_DELETE')")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteCustomer(@PathVariable Long id) {
        customerService.deleteCustomer(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Customer deleted successfully"));
    }

    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_WRITE')")
    @PostMapping("/{id}/contacts")
    public ResponseEntity<ApiResponse<com.arudra.crm.dto.ContactPersonDTO>> addContact(@PathVariable Long id, @RequestBody com.arudra.crm.dto.ContactPersonDTO dto) {
        com.arudra.crm.entity.ContactPerson entity = new com.arudra.crm.entity.ContactPerson();
        entity.setName(dto.getName());
        entity.setDesignation(dto.getDesignation());
        entity.setPhone(dto.getPhone());
        entity.setEmail(dto.getEmail());
        entity.setIsPrimary(dto.getIsPrimary());
        entity.setWhatsapp(dto.getWhatsapp());
        entity.setNotes(dto.getNotes());
        com.arudra.crm.entity.ContactPerson saved = customerService.addContactPerson(id, entity);
        
        com.arudra.crm.dto.ContactPersonDTO responseDto = new com.arudra.crm.dto.ContactPersonDTO();
        responseDto.setId(saved.getId());
        responseDto.setName(saved.getName());
        responseDto.setDesignation(saved.getDesignation());
        responseDto.setPhone(saved.getPhone());
        responseDto.setEmail(saved.getEmail());
        responseDto.setIsPrimary(saved.getIsPrimary());
        responseDto.setWhatsapp(saved.getWhatsapp());
        responseDto.setNotes(saved.getNotes());
        return ResponseEntity.ok(ApiResponse.success(responseDto));
    }


    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_WRITE')")
    @PostMapping("/{id}/documents")
    public ResponseEntity<ApiResponse<com.arudra.crm.dto.CustomerDocumentDTO>> addDocument(@PathVariable Long id, @RequestBody com.arudra.crm.dto.CustomerDocumentDTO dto, org.springframework.security.core.Authentication authentication) {
        com.arudra.crm.entity.CustomerDocument entity = new com.arudra.crm.entity.CustomerDocument();
        entity.setFileName(dto.getFileName());
        entity.setFileUrl(dto.getFileUrl());
        entity.setFileType(dto.getFileType());
        
        com.arudra.crm.entity.CustomerDocument saved = customerService.addDocument(id, entity, authentication.getName());
        
        com.arudra.crm.dto.CustomerDocumentDTO responseDto = new com.arudra.crm.dto.CustomerDocumentDTO();
        responseDto.setId(saved.getId());
        responseDto.setFileName(saved.getFileName());
        responseDto.setFileUrl(saved.getFileUrl());
        responseDto.setFileType(saved.getFileType());
        responseDto.setUploadedByName(saved.getUploadedBy().getName());
        responseDto.setCreatedAt(saved.getCreatedAt());
        return ResponseEntity.ok(ApiResponse.success(responseDto));
    }


    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_WRITE')")
    @PostMapping("/{id}/activities")
    public ResponseEntity<ApiResponse<com.arudra.crm.dto.CustomerActivityDTO>> addActivity(@PathVariable Long id, @RequestBody com.arudra.crm.dto.CustomerActivityDTO dto, org.springframework.security.core.Authentication authentication) {
        com.arudra.crm.entity.CustomerActivity entity = new com.arudra.crm.entity.CustomerActivity();
        entity.setAction(dto.getAction());
        entity.setDescription(dto.getDescription());
        entity.setChannel(dto.getChannel());
        entity.setCustomerMood(dto.getCustomerMood());
        entity.setOutcome(dto.getOutcome());
        entity.setCustomerResponse(dto.getCustomerResponse());
        entity.setAttachmentUrl(dto.getAttachmentUrl());
        entity.setAttachmentFileName(dto.getAttachmentFileName());

        com.arudra.crm.entity.CustomerActivity saved = customerService.addActivity(id, entity, authentication.getName());

        com.arudra.crm.dto.CustomerActivityDTO responseDto = new com.arudra.crm.dto.CustomerActivityDTO();
        responseDto.setId(saved.getId());
        responseDto.setAction(saved.getAction());
        responseDto.setDescription(saved.getDescription());
        responseDto.setPerformedByName(saved.getPerformedBy().getName());
        responseDto.setCreatedAt(saved.getCreatedAt());
        responseDto.setChannel(saved.getChannel());
        responseDto.setCustomerMood(saved.getCustomerMood());
        responseDto.setOutcome(saved.getOutcome());
        responseDto.setCustomerResponse(saved.getCustomerResponse());
        responseDto.setAttachmentUrl(saved.getAttachmentUrl());
        responseDto.setAttachmentFileName(saved.getAttachmentFileName());
        return ResponseEntity.ok(ApiResponse.success(responseDto));
    }


    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('CUSTOMER_WRITE')")
    @PostMapping("/{id}/notes")
    public ResponseEntity<ApiResponse<com.arudra.crm.dto.CustomerNoteDTO>> addNote(@PathVariable Long id, @RequestBody com.arudra.crm.dto.CustomerNoteDTO dto, org.springframework.security.core.Authentication authentication) {
        com.arudra.crm.entity.CustomerNote entity = new com.arudra.crm.entity.CustomerNote();
        entity.setNoteType(dto.getNoteType());
        entity.setContent(dto.getContent());
        
        com.arudra.crm.entity.CustomerNote saved = customerService.addNote(id, entity, authentication.getName());
        
        com.arudra.crm.dto.CustomerNoteDTO responseDto = new com.arudra.crm.dto.CustomerNoteDTO();
        responseDto.setId(saved.getId());
        responseDto.setNoteType(saved.getNoteType());
        responseDto.setContent(saved.getContent());
        responseDto.setAuthorName(saved.getAuthor().getName());
        responseDto.setCreatedAt(saved.getCreatedAt());
        return ResponseEntity.ok(ApiResponse.success(responseDto));
    }

}