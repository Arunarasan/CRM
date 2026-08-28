package com.arudra.crm.dto.lead;

import lombok.Data;

/**
 * Payload for editing a lead's referral details in isolation (its own endpoint), so updating the
 * referral never touches the rest of the lead and vice-versa. Referrer links are sent as ids.
 */
@Data
public class LeadReferralRequest {
    private String referralType;          // "Existing Customer" | "Employee" | "Other"
    private Long referredByCustomerId;    // set when referralType == "Existing Customer"
    private Long referredByEmployeeId;    // set when referralType == "Employee"
    private String referrerName;
    private String referrerContact;
    private String referralNotes;
}
