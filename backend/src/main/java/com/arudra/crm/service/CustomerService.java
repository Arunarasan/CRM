package com.arudra.crm.service;

import com.arudra.crm.entity.Customer;
import com.arudra.crm.repository.CustomerRepository;
import com.arudra.crm.repository.CustomerSpecification;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import com.arudra.crm.annotation.LogActivity;

@Service
public class CustomerService {

    @Autowired
    private CustomerRepository customerRepository;

    public Page<Customer> getCustomersAdvanced(String search, String name, String city, String email, String phone, String tag, int page, int size, String sortField, String sortDir) {
        Sort sort = sortDir.equalsIgnoreCase(Sort.Direction.ASC.name()) ? Sort.by(sortField).ascending() : Sort.by(sortField).descending();
        PageRequest pageRequest = PageRequest.of(page, size, sort);
        
        Specification<Customer> spec = Specification.where(null);
        
        if (search != null && !search.isEmpty()) {
            return customerRepository.searchCustomers(search, pageRequest);
        }
        
        if (name != null && !name.isEmpty()) spec = spec.and(CustomerSpecification.hasName(name));
        if (city != null && !city.isEmpty()) spec = spec.and(CustomerSpecification.hasCity(city));
        if (email != null && !email.isEmpty()) spec = spec.and(CustomerSpecification.hasEmail(email));
        if (phone != null && !phone.isEmpty()) spec = spec.and(CustomerSpecification.hasPhone(phone));
        if (tag != null && !tag.isEmpty()) spec = spec.and(CustomerSpecification.hasTag(tag));

        return customerRepository.findAll(spec, pageRequest);
    }

    // Retaining old method for backward compatibility if used elsewhere
    public Page<Customer> getCustomers(String search, int page, int size) {
        return getCustomersAdvanced(search, null, null, null, null, null, page, size, "id", "desc");
    }

    public Customer getCustomerById(Long id) {
        return customerRepository.findById(id).orElseThrow(() -> new RuntimeException("Customer not found"));
    }


    @Autowired
    private com.arudra.crm.repository.QuotationRepository quotationRepository;
    @Autowired
    private com.arudra.crm.repository.InvoiceRepository invoiceRepository;
    @Autowired
    private com.arudra.crm.repository.CustomerPaymentRepository customerPaymentRepository;

    @Autowired
    private com.arudra.crm.repository.UserRepository userRepository;
    @Autowired
    private com.arudra.crm.repository.CustomerAddressRepository addressRepository;
    @Autowired
    private com.arudra.crm.repository.ContactPersonRepository contactRepository;
    @Autowired
    private com.arudra.crm.repository.CustomerNoteRepository noteRepository;
    @Autowired
    private com.arudra.crm.repository.CustomerDocumentRepository documentRepository;
    @Autowired
    private com.arudra.crm.repository.CustomerActivityRepository activityRepository;
    @Autowired
    private com.arudra.crm.repository.ProjectRepository projectRepository;
    @Autowired
    private com.arudra.crm.repository.LeadRepository leadRepository;
    @Autowired
    private com.arudra.crm.repository.SiteVisitRepository siteVisitRepository;
    @Autowired
    private com.arudra.crm.repository.TaskRepository taskRepository;

    public com.arudra.crm.dto.CustomerProfileDTO getCustomerProfile(Long id) {
        Customer customer = getCustomerById(id);
        com.arudra.crm.dto.CustomerProfileDTO profile = new com.arudra.crm.dto.CustomerProfileDTO();
        profile.setId(customer.getId());
        profile.setName(customer.getName());
        profile.setPhone(customer.getPhone());
        profile.setEmail(customer.getEmail());
        profile.setBillingAddress(customer.getBillingAddress());
        profile.setSiteAddress(customer.getSiteAddress());
        profile.setCity(customer.getCity());
        profile.setDistrict(customer.getDistrict());
        profile.setState(customer.getState());
        profile.setCountry(customer.getCountry());
        profile.setPincode(customer.getPincode());
        profile.setGoogleMapLocation(customer.getGoogleMapLocation());
        profile.setLatitude(customer.getLatitude());
        profile.setLongitude(customer.getLongitude());
        profile.setGstNumber(customer.getGstNumber());
        profile.setCustomerCode(customer.getCustomerCode());
        profile.setCustomerType(customer.getCustomerType());
        profile.setCompanyName(customer.getCompanyName());
        profile.setContactPersonName(customer.getContactPersonName());
        profile.setAlternatePhone(customer.getAlternatePhone());
        profile.setWhatsappNumber(customer.getWhatsappNumber());
        profile.setWebsite(customer.getWebsite());
        profile.setPanNumber(customer.getPanNumber());
        profile.setCustomerSince(customer.getCustomerSince());
        profile.setStatus(customer.getStatus());
        profile.setPhotoUrl(customer.getPhotoUrl());
        profile.setPreferredLanguage(customer.getPreferredLanguage());
        profile.setPreferredContactMethod(customer.getPreferredContactMethod());

        java.util.List<com.arudra.crm.entity.Project> customerProjects = projectRepository.findByCustomerId(id);
        profile.setTotalProjects(customerProjects.size());
        
        int running = 0, completed = 0, cancelled = 0, upcoming = 0;
        java.math.BigDecimal totalValue = java.math.BigDecimal.ZERO;
        java.time.LocalDate lastDate = null;
        
        for (com.arudra.crm.entity.Project p : customerProjects) {
            if ("RUNNING".equalsIgnoreCase(p.getStatus())) running++;
            else if ("COMPLETED".equalsIgnoreCase(p.getStatus())) completed++;
            else if ("CANCELLED".equalsIgnoreCase(p.getStatus())) cancelled++;
            else upcoming++; // PLANNING, ON_HOLD, etc.
            
            if (p.getBudget() != null) {
                totalValue = totalValue.add(p.getBudget());
            }
            if (p.getStartDate() != null) {
                if (lastDate == null || p.getStartDate().isAfter(lastDate)) {
                    lastDate = p.getStartDate();
                }
            }
        }
        
        profile.setRunningProjects(running);
        profile.setCompletedProjects(completed);
        profile.setCancelledProjects(cancelled);
        profile.setUpcomingProjects(upcoming);
        profile.setProjectValue(totalValue);
        profile.setLastProjectDate(lastDate);


        profile.setCreditLimit(customer.getCreditLimit());
        profile.setPaymentTerms(customer.getPaymentTerms());

        java.util.List<com.arudra.crm.entity.Quotation> quotations = quotationRepository.findByCustomerId(id);
        java.math.BigDecimal totalQuotation = java.math.BigDecimal.ZERO;
        for (com.arudra.crm.entity.Quotation q : quotations) {
            if (q.getGrandTotal() != null) totalQuotation = totalQuotation.add(q.getGrandTotal());
        }
        profile.setTotalQuotationValue(totalQuotation);

        java.util.List<com.arudra.crm.entity.Invoice> invoices = invoiceRepository.findByCustomerId(id);
        java.math.BigDecimal totalInvoice = java.math.BigDecimal.ZERO;
        for (com.arudra.crm.entity.Invoice inv : invoices) {
            if (inv.getTotalAmount() != null) totalInvoice = totalInvoice.add(inv.getTotalAmount());
        }
        profile.setTotalInvoiceAmount(totalInvoice);

        java.util.List<com.arudra.crm.entity.CustomerPayment> payments = customerPaymentRepository.findByCustomerId(id);
        java.math.BigDecimal totalPaid = java.math.BigDecimal.ZERO;
        java.math.BigDecimal advancePaid = java.math.BigDecimal.ZERO;
        java.time.LocalDate lastPayment = null;
        for (com.arudra.crm.entity.CustomerPayment p : payments) {
            if (p.getAmount() != null) {
                totalPaid = totalPaid.add(p.getAmount());
                if (p.getInvoice() == null) {
                    advancePaid = advancePaid.add(p.getAmount());
                }
            }
            if (p.getPaymentDate() != null) {
                if (lastPayment == null || p.getPaymentDate().isAfter(lastPayment)) {
                    lastPayment = p.getPaymentDate();
                }
            }
        }
        profile.setTotalPaid(totalPaid);
        profile.setAdvancePaid(advancePaid);
        profile.setLastPaymentDate(lastPayment);
        profile.setOutstandingAmount(totalInvoice.subtract(totalPaid));


        profile.setTags(customer.getTags().stream().map(t -> {
            com.arudra.crm.dto.TagDTO td = new com.arudra.crm.dto.TagDTO();
            td.setId(t.getId());
            td.setName(t.getName());
            td.setColor(t.getColor());
            return td;
        }).collect(java.util.stream.Collectors.toList()));

        profile.setAddresses(addressRepository.findByCustomerId(id).stream().map(a -> {
            com.arudra.crm.dto.CustomerAddressDTO ad = new com.arudra.crm.dto.CustomerAddressDTO();
            ad.setId(a.getId());
            ad.setLabel(a.getLabel());
            ad.setAddress(a.getAddress());
            ad.setCity(a.getCity());
            ad.setState(a.getState());
            ad.setPincode(a.getPincode());
            ad.setIsPrimary(a.getIsPrimary());
            return ad;
        }).collect(java.util.stream.Collectors.toList()));

        profile.setContacts(contactRepository.findByCustomerId(id).stream().map(c -> {
            com.arudra.crm.dto.ContactPersonDTO cd = new com.arudra.crm.dto.ContactPersonDTO();
            cd.setId(c.getId());
            cd.setName(c.getName());
            cd.setDesignation(c.getDesignation());
            cd.setPhone(c.getPhone());
            cd.setEmail(c.getEmail());
            cd.setIsPrimary(c.getIsPrimary());
            return cd;
        }).collect(java.util.stream.Collectors.toList()));

        profile.setNotes(noteRepository.findByCustomerIdOrderByCreatedAtDesc(id).stream().map(n -> {
            com.arudra.crm.dto.CustomerNoteDTO nd = new com.arudra.crm.dto.CustomerNoteDTO();
            nd.setId(n.getId());
            nd.setContent(n.getContent());
            nd.setAuthorName(n.getAuthor() != null ? n.getAuthor().getName() : "Unknown");
            nd.setCreatedAt(n.getCreatedAt());
            return nd;
        }).collect(java.util.stream.Collectors.toList()));

        profile.setDocuments(documentRepository.findByCustomerIdOrderByCreatedAtDesc(id).stream().map(d -> {
            com.arudra.crm.dto.CustomerDocumentDTO dd = new com.arudra.crm.dto.CustomerDocumentDTO();
            dd.setId(d.getId());
            dd.setFileName(d.getFileName());
            dd.setFileUrl(d.getFileUrl());
            dd.setFileType(d.getFileType());
            dd.setUploadedByName(d.getUploadedBy() != null ? d.getUploadedBy().getName() : "Unknown");
            dd.setCreatedAt(d.getCreatedAt());
            return dd;
        }).collect(java.util.stream.Collectors.toList()));

        profile.setTimeline(activityRepository.findByCustomerIdOrderByCreatedAtDesc(id).stream().map(a -> {
            com.arudra.crm.dto.CustomerActivityDTO ad = new com.arudra.crm.dto.CustomerActivityDTO();
            ad.setId(a.getId());
            ad.setAction(a.getAction());
            ad.setDescription(a.getDescription());
            ad.setPerformedByName(a.getPerformedBy() != null ? a.getPerformedBy().getName() : "Unknown");
            ad.setCreatedAt(a.getCreatedAt());
            return ad;
        }).collect(java.util.stream.Collectors.toList()));


        profile.setProjects(customerProjects.stream().map(p -> {
            com.arudra.crm.dto.CustomerProfileDTO.ProjectMiniDTO pm = new com.arudra.crm.dto.CustomerProfileDTO.ProjectMiniDTO();
            pm.setId(p.getId());
            pm.setName(p.getProjectName());
            pm.setStatus(p.getStatus());
            pm.setStartDate(p.getStartDate());
            pm.setEndDate(p.getEndDate());
            return pm;
        }).collect(java.util.stream.Collectors.toList()));

        profile.setQuotations(quotations.stream().map(q -> {
            com.arudra.crm.dto.CustomerProfileDTO.QuotationMiniDTO qm = new com.arudra.crm.dto.CustomerProfileDTO.QuotationMiniDTO();
            qm.setId(q.getId());
            qm.setQuotationNumber(q.getQuotationNumber());
            qm.setStatus(q.getStatus());
            qm.setTotalAmount(q.getGrandTotal());
            qm.setIssueDate(q.getCreatedAt() != null ? q.getCreatedAt().toLocalDate() : null);
            return qm;
        }).collect(java.util.stream.Collectors.toList()));

        profile.setInvoices(invoices.stream().map(i -> {
            com.arudra.crm.dto.CustomerProfileDTO.InvoiceMiniDTO im = new com.arudra.crm.dto.CustomerProfileDTO.InvoiceMiniDTO();
            im.setId(i.getId());
            im.setInvoiceNumber(i.getInvoiceNumber());
            im.setStatus(i.getStatus());
            im.setGrandTotal(i.getTotalAmount());
            im.setIssueDate(i.getDate());
            im.setDueDate(i.getDueDate());
            return im;
        }).collect(java.util.stream.Collectors.toList()));

        profile.setPayments(payments.stream().map(p -> {
            com.arudra.crm.dto.CustomerProfileDTO.PaymentMiniDTO pm = new com.arudra.crm.dto.CustomerProfileDTO.PaymentMiniDTO();
            pm.setId(p.getId());
            pm.setReceiptNumber(p.getReferenceNumber());
            pm.setAmount(p.getAmount());
            pm.setPaymentDate(p.getPaymentDate());
            pm.setPaymentMethod(p.getPaymentMethod());
            pm.setStatus("Completed");
            return pm;
        }).collect(java.util.stream.Collectors.toList()));

        profile.setLeads(leadRepository.findByConvertedToCustomerId(id).stream().map(l -> {
            com.arudra.crm.dto.CustomerProfileDTO.LeadMiniDTO lm = new com.arudra.crm.dto.CustomerProfileDTO.LeadMiniDTO();
            lm.setId(l.getId());
            lm.setStatus(l.getStatus());
            lm.setCreatedAt(l.getCreatedAt());
            lm.setLeadSource(l.getLeadSource());
            return lm;
        }).collect(java.util.stream.Collectors.toList()));

        profile.setSiteVisits(siteVisitRepository.findByCustomerIdAndIsDeletedFalseOrderByScheduledTimeDesc(id).stream().map(s -> {
            com.arudra.crm.dto.CustomerProfileDTO.SiteVisitMiniDTO sm = new com.arudra.crm.dto.CustomerProfileDTO.SiteVisitMiniDTO();
            sm.setId(s.getId());
            sm.setStatus(s.getStatus());
            sm.setScheduledTime(s.getScheduledTime());
            sm.setLocationAddress(s.getLocationAddress());
            return sm;
        }).collect(java.util.stream.Collectors.toList()));

        profile.setTasks(taskRepository.findByProjectCustomerIdOrderByDueDateAsc(id).stream().map(t -> {
            com.arudra.crm.dto.CustomerProfileDTO.TaskMiniDTO tm = new com.arudra.crm.dto.CustomerProfileDTO.TaskMiniDTO();
            tm.setId(t.getId());
            tm.setTitle(t.getTaskName());
            tm.setStatus(t.getStatus());
            tm.setPriority(t.getPriority());
            tm.setDueDate(t.getDueDate());
            return tm;
        }).collect(java.util.stream.Collectors.toList()));

        return profile;
    }

    @LogActivity(module = "CUSTOMER", action = "CREATE")
    public Customer createCustomer(Customer customer) {
        if (customer.getCustomerCode() == null || customer.getCustomerCode().isEmpty()) {
            customer.setCustomerCode("CUST-" + System.currentTimeMillis());
        }
        if (customer.getCustomerSince() == null) {
            customer.setCustomerSince(java.time.LocalDate.now());
        }
        return customerRepository.save(customer);
    }

    @LogActivity(module = "CUSTOMER", action = "UPDATE")
    public Customer updateCustomer(Long id, Customer customerDetails) {
        Customer customer = getCustomerById(id);
        customer.setName(customerDetails.getName());
        customer.setPhone(customerDetails.getPhone());
        customer.setEmail(customerDetails.getEmail());
        customer.setBillingAddress(customerDetails.getBillingAddress());
        customer.setSiteAddress(customerDetails.getSiteAddress());
        customer.setCity(customerDetails.getCity());
        customer.setDistrict(customerDetails.getDistrict());
        customer.setState(customerDetails.getState());
        customer.setCountry(customerDetails.getCountry());
        customer.setPincode(customerDetails.getPincode());
        customer.setGoogleMapLocation(customerDetails.getGoogleMapLocation());
        customer.setLatitude(customerDetails.getLatitude());
        customer.setLongitude(customerDetails.getLongitude());
        customer.setGstNumber(customerDetails.getGstNumber());
        customer.setCustomerType(customerDetails.getCustomerType());
        customer.setCompanyName(customerDetails.getCompanyName());
        customer.setContactPersonName(customerDetails.getContactPersonName());
        customer.setAlternatePhone(customerDetails.getAlternatePhone());
        customer.setWhatsappNumber(customerDetails.getWhatsappNumber());
        customer.setWebsite(customerDetails.getWebsite());
        customer.setPanNumber(customerDetails.getPanNumber());
        customer.setPreferredLanguage(customerDetails.getPreferredLanguage());
        customer.setPreferredContactMethod(customerDetails.getPreferredContactMethod());
        if (customerDetails.getPhotoUrl() != null) customer.setPhotoUrl(customerDetails.getPhotoUrl());
        if (customerDetails.getStatus() != null) customer.setStatus(customerDetails.getStatus());
        return customerRepository.save(customer);
    }

    public void deleteCustomer(Long id) {
        Customer customer = getCustomerById(id);
        customerRepository.delete(customer);
    }

    public com.arudra.crm.entity.ContactPerson addContactPerson(Long customerId, com.arudra.crm.entity.ContactPerson contact) {
        Customer customer = getCustomerById(customerId);
        contact.setCustomer(customer);
        return contactRepository.save(contact);
    }


    public com.arudra.crm.entity.CustomerDocument addDocument(Long customerId, com.arudra.crm.entity.CustomerDocument document, String username) {
        Customer customer = getCustomerById(customerId);
        document.setCustomer(customer);
        
        com.arudra.crm.entity.User uploadedBy = userRepository.findByEmail(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        document.setUploadedBy(uploadedBy);
        
        return documentRepository.save(document);
    }


    public com.arudra.crm.entity.CustomerActivity addActivity(Long customerId, com.arudra.crm.entity.CustomerActivity activity, String username) {
        Customer customer = getCustomerById(customerId);
        activity.setCustomer(customer);
        
        com.arudra.crm.entity.User performedBy = userRepository.findByEmail(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        activity.setPerformedBy(performedBy);
        
        return activityRepository.save(activity);
    }


    public com.arudra.crm.entity.CustomerNote addNote(Long customerId, com.arudra.crm.entity.CustomerNote note, String username) {
        Customer customer = getCustomerById(customerId);
        note.setCustomer(customer);
        
        com.arudra.crm.entity.User author = userRepository.findByEmail(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        note.setAuthor(author);
        
        return noteRepository.save(note);
    }

}