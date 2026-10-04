package com.arudra.crm.service;

import com.arudra.crm.entity.Lead;
import com.arudra.crm.entity.Quotation;
import com.arudra.crm.entity.QuotationItem;
import com.arudra.crm.repository.QuotationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** The public quotation link: token gate, customer-safe whitelist, and the accept rules. */
@ExtendWith(MockitoExtension.class)
class QuotationShareServiceTest {

    private static final String TOKEN = "a".repeat(64);

    @Mock private QuotationRepository quotationRepository;
    @Mock private NotificationService notificationService;
    @InjectMocks private QuotationShareService service;

    private Quotation quote(String status) {
        Quotation q = new Quotation();
        q.setId(7L);
        q.setQuotationNumber("QT-101");
        q.setStatus(status);
        q.setShareToken(TOKEN);
        q.setGrandTotal(new BigDecimal("1180"));
        q.setGst(new BigDecimal("180"));
        QuotationItem kept = new QuotationItem();
        kept.setItemName("Curtain");
        kept.setCategory("Curtain");
        kept.setQuantity(new BigDecimal("2"));
        kept.setRate(new BigDecimal("500"));
        kept.setTotalAmount(new BigDecimal("1000"));
        kept.setCostAmount(new BigDecimal("300"));
        kept.setStatus("PENDING");
        QuotationItem dropped = new QuotationItem();
        dropped.setItemName("Blind");
        dropped.setStatus("REJECTED");
        dropped.setTotalAmount(new BigDecimal("999"));
        q.setItems(List.of(kept, dropped));
        Lead lead = new Lead();
        lead.setId(3L);
        lead.setName("Ravi");
        q.setLead(lead);
        return q;
    }

    @Test
    void view_unknownOrDisabledToken_isNotFound() {
        when(quotationRepository.findByShareToken(TOKEN)).thenReturn(Optional.empty());
        assertThrows(ResponseStatusException.class, () -> service.view(TOKEN));

        Quotation off = quote("SENT");
        off.setShareEnabled(false);
        when(quotationRepository.findByShareToken(TOKEN)).thenReturn(Optional.of(off));
        assertThrows(ResponseStatusException.class, () -> service.view(TOKEN));

        assertThrows(ResponseStatusException.class, () -> service.view("short"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void view_showsOnlyCustomerFacingFields() {
        when(quotationRepository.findByShareToken(TOKEN)).thenReturn(Optional.of(quote("SENT")));
        Map<String, Object> v = service.view(TOKEN);

        assertEquals("OPEN", v.get("state"));
        assertEquals("Ravi", v.get("customerName"));
        List<Map<String, Object>> items = (List<Map<String, Object>>) v.get("items");
        assertEquals(1, items.size(), "rejected lines are left out");
        assertEquals("Curtain", items.get(0).get("name"));
        assertFalse(items.get(0).containsKey("costAmount"), "internal cost never leaves the CRM");
        assertFalse(v.containsKey("id"));
        assertEquals(new BigDecimal("1000"), v.get("productsNet"));
    }

    @Test
    void accept_recordsOnceAndAlertsTheTeam() {
        Quotation q = quote("SENT");
        when(quotationRepository.findByShareToken(TOKEN)).thenReturn(Optional.of(q));

        Map<String, Object> v = service.accept(TOKEN, Map.of("name", "Ravi Kumar", "note", "Start Monday"));

        assertEquals("ACCEPTED", v.get("state"));
        assertEquals("Ravi Kumar", q.getCustomerAcceptedName());
        assertNotNull(q.getCustomerAcceptedAt());
        verify(notificationService).dispatchToAdmins(contains("QT-101"), anyString(), eq("QUOTATION"), eq("/leads/3?tab=journey"), isNull());

        // A second press changes nothing and sends no second alert.
        service.accept(TOKEN, Map.of("name", "Someone else"));
        assertEquals("Ravi Kumar", q.getCustomerAcceptedName());
        verify(notificationService, times(1)).dispatchToAdmins(anyString(), anyString(), anyString(), anyString(), any());
    }

    @Test
    void accept_refusedOnReplacedQuoteOrWithoutName() {
        Quotation revised = quote("REVISED");
        when(quotationRepository.findByShareToken(TOKEN)).thenReturn(Optional.of(revised));
        assertThrows(ResponseStatusException.class, () -> service.accept(TOKEN, Map.of("name", "Ravi")));

        Quotation open = quote("SENT");
        when(quotationRepository.findByShareToken(TOKEN)).thenReturn(Optional.of(open));
        assertThrows(ResponseStatusException.class, () -> service.accept(TOKEN, Map.of("name", "  ")));
        assertNull(open.getCustomerAcceptedAt());
        verifyNoInteractions(notificationService);
    }

    @Test
    void share_createsTokenAndKeepsItOnReshare() {
        Quotation q = quote("SENT");
        q.setShareToken(null);
        when(quotationRepository.findById(7L)).thenReturn(Optional.of(q));
        when(quotationRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        String first = (String) service.share(7L, "/uploads/q.pdf").get("shareToken");
        assertEquals(64, first.length());
        assertEquals("/uploads/q.pdf", q.getSharePdfUrl());
        assertEquals(first, service.share(7L, null).get("shareToken"), "re-sharing keeps the link already sent");
        assertNotEquals(first, service.regenerate(7L).get("shareToken"));
    }
}
