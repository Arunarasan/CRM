package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class BillingService {

    @Autowired private InvoiceRepository invoiceRepository;
    @Autowired private InvoiceItemRepository itemRepository;
    @Autowired private CustomerPaymentRepository paymentRepository;
    @Autowired private CreditDebitNoteRepository noteRepository;

    // --- Invoices ---
    public Page<Invoice> getInvoices(int page, int size) {
        return invoiceRepository.findAllByOrderByDateDesc(PageRequest.of(page, size));
    }
    
    public Optional<Invoice> getInvoice(Long id) {
        return invoiceRepository.findById(id);
    }
    
    public List<InvoiceItem> getInvoiceItems(Long invoiceId) {
        return itemRepository.findByInvoiceId(invoiceId);
    }

    @Transactional
    public Invoice createInvoice(Invoice invoice, List<InvoiceItem> items) {
        invoice.setDate(LocalDate.now());
        invoice.setStatus("DRAFT");
        
        BigDecimal subTotal = BigDecimal.ZERO;
        BigDecimal totalGst = BigDecimal.ZERO;
        
        for (InvoiceItem item : items) {
            BigDecimal lineTotal = item.getUnitPrice().multiply(new BigDecimal(item.getQuantity()));
            BigDecimal lineGst = lineTotal.multiply(item.getGstRate()).divide(new BigDecimal(100));
            
            item.setTotalPrice(lineTotal.add(lineGst));
            subTotal = subTotal.add(lineTotal);
            totalGst = totalGst.add(lineGst);
        }
        
        invoice.setSubTotal(subTotal);
        invoice.setGstAmount(totalGst);
        invoice.setTotalAmount(subTotal.add(totalGst));
        
        Invoice savedInvoice = invoiceRepository.save(invoice);
        
        for (InvoiceItem item : items) {
            item.setInvoice(savedInvoice);
            itemRepository.save(item);
        }
        
        return savedInvoice;
    }

    public Invoice updateInvoiceStatus(Long id, String status) {
        Invoice invoice = invoiceRepository.findById(id).orElseThrow();
        invoice.setStatus(status);
        return invoiceRepository.save(invoice);
    }

    // --- Payments ---
    public Page<CustomerPayment> getPayments(int page, int size) {
        return paymentRepository.findAllByOrderByPaymentDateDesc(PageRequest.of(page, size));
    }
    
    public List<CustomerPayment> getPaymentsForInvoice(Long invoiceId) {
        return paymentRepository.findByInvoiceId(invoiceId);
    }

    @Transactional
    public CustomerPayment addPayment(CustomerPayment payment) {
        if (payment.getPaymentDate() == null) {
            payment.setPaymentDate(LocalDate.now());
        }
        CustomerPayment saved = paymentRepository.save(payment);
        
        if (payment.getInvoice() != null) {
            recalculateInvoiceStatus(payment.getInvoice().getId());
        }
        
        return saved;
    }

    // --- Credit/Debit Notes ---
    public Page<CreditDebitNote> getNotes(int page, int size) {
        return noteRepository.findAllByOrderByDateDesc(PageRequest.of(page, size));
    }
    
    public List<CreditDebitNote> getNotesForInvoice(Long invoiceId) {
        return noteRepository.findByInvoiceId(invoiceId);
    }
    
    @Transactional
    public CreditDebitNote addNote(CreditDebitNote note) {
        if (note.getDate() == null) {
            note.setDate(LocalDate.now());
        }
        CreditDebitNote saved = noteRepository.save(note);
        
        if (note.getInvoice() != null) {
            recalculateInvoiceStatus(note.getInvoice().getId());
        }
        
        return saved;
    }

    // --- Core Logic ---
    private void recalculateInvoiceStatus(Long invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId).orElseThrow();
        
        List<CustomerPayment> payments = paymentRepository.findByInvoiceId(invoiceId);
        List<CreditDebitNote> notes = noteRepository.findByInvoiceId(invoiceId);
        
        BigDecimal totalPaid = BigDecimal.ZERO;
        for (CustomerPayment p : payments) {
            totalPaid = totalPaid.add(p.getAmount());
        }
        
        BigDecimal totalCredits = BigDecimal.ZERO;
        for (CreditDebitNote n : notes) {
            if ("CREDIT".equals(n.getType())) {
                totalCredits = totalCredits.add(n.getAmount());
            } else if ("DEBIT".equals(n.getType())) {
                totalCredits = totalCredits.subtract(n.getAmount());
            }
        }
        
        BigDecimal effectivePayment = totalPaid.add(totalCredits);
        
        if (effectivePayment.compareTo(invoice.getTotalAmount()) >= 0) {
            invoice.setStatus("PAID");
        } else if (effectivePayment.compareTo(BigDecimal.ZERO) > 0) {
            invoice.setStatus("PARTIAL");
        } else {
            // Keep current status if no payments yet, unless it was PAID and payment removed
            if ("PAID".equals(invoice.getStatus()) || "PARTIAL".equals(invoice.getStatus())) {
                 invoice.setStatus("SENT");
            }
        }
        
        invoiceRepository.save(invoice);
    }
}
