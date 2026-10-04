-- JB Decor's real business details (they were still the seeded placeholders: "+91 90000 00000",
-- "hello@jbdecor.com", "JB Decor Studio, Bengaluru"). These rows feed the public website (header,
-- footer, contact page, WhatsApp button, local-search schema), the customer quotation link and the
-- CRM's company profile (quotation print/PDF, share message). Inserted when missing, else replaced.
INSERT INTO site_settings (setting_key, setting_value, group_name, label, input_type, display_order, is_deleted, version)
VALUES
    ('contact.phone',      '+91 95248 66006',                                                      'Contact',  'Phone',           'tel',      4,  b'0', 0),
    ('contact.email',      'jbdecorcdm@gmail.com',                                                 'Contact',  'Email',           'email',    5,  b'0', 0),
    ('contact.whatsapp',   '919524866006',                                                         'Contact',  'WhatsApp number', 'tel',      6,  b'0', 0),
    ('contact.address',    'JB Decor, 64/82, North Car Street, Chidambaram, Cuddalore - 608 001', 'Contact',  'Address',         'textarea', 7,  b'0', 0),
    ('contact.city',       'Chidambaram',                                                          'Location', 'City',            'text',     14, b'0', 0),
    ('contact.region',     'Tamil Nadu',                                                           'Location', 'State',           'text',     15, b'0', 0),
    ('contact.postalCode', '608001',                                                               'Location', 'PIN code',        'text',     16, b'0', 0)
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), is_deleted = b'0';
