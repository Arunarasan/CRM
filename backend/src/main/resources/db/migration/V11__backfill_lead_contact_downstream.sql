-- Site visits created before SiteVisitService.inheritFromLead existed never copied the lead's
-- contact/address, so every downstream document showed blanks. Fill only what is still NULL —
-- anything typed on the visit itself must win.
UPDATE site_visits sv
JOIN leads l ON sv.lead_id = l.id
SET sv.customer_contact_person = COALESCE(sv.customer_contact_person, l.name),
    sv.customer_mobile         = COALESCE(sv.customer_mobile, l.mobile_number),
    sv.location_address        = COALESCE(sv.location_address, l.address),
    sv.property_type           = COALESCE(sv.property_type, l.property_type)
WHERE sv.lead_id IS NOT NULL;

-- Where the lead has since been converted, adopt its customer on documents that were raised while
-- the lead was still a lead. Rows whose lead is unconverted stay NULL and keep riding on lead_id.
UPDATE site_visits sv
JOIN leads l ON sv.lead_id = l.id
SET sv.customer_id = l.converted_customer_id
WHERE sv.customer_id IS NULL AND l.converted_customer_id IS NOT NULL;

UPDATE measurements m
JOIN leads l ON m.lead_id = l.id
SET m.customer_id = l.converted_customer_id
WHERE m.customer_id IS NULL AND l.converted_customer_id IS NOT NULL;

UPDATE boqs b
JOIN leads l ON b.lead_id = l.id
SET b.customer_id = l.converted_customer_id
WHERE b.customer_id IS NULL AND l.converted_customer_id IS NOT NULL;

UPDATE quotations q
JOIN leads l ON q.lead_id = l.id
SET q.customer_id = l.converted_customer_id
WHERE q.customer_id IS NULL AND l.converted_customer_id IS NOT NULL;

-- Measurements raised from a site visit before the inheritance fix can still recover the visit's
-- address/property details.
UPDATE measurements m
JOIN site_visits sv ON m.site_visit_id = sv.id
SET m.site_address     = COALESCE(m.site_address, sv.location_address),
    m.property_type    = COALESCE(m.property_type, sv.property_type),
    m.construction_stage = COALESCE(m.construction_stage, sv.construction_stage),
    m.total_floors     = COALESCE(m.total_floors, sv.total_floors),
    m.total_area       = COALESCE(m.total_area, sv.area_sqft)
WHERE m.site_visit_id IS NOT NULL;
