-- Letterhead text (address + phone numbers) is now typed live onto the banner from these settings.
-- Second phone: new, blank until set in Settings > Company (shown beside the first number).
INSERT INTO site_settings (setting_key, setting_value, group_name, label, input_type, display_order, is_deleted, version)
VALUES ('contact.phone2', '', 'Contact', 'Second phone', 'tel', 5, b'0', 0)
ON DUPLICATE KEY UPDATE is_deleted = b'0';

-- The old banner image spelled the address out in full; only widen the untouched seeded value.
UPDATE site_settings
   SET setting_value = 'JB Decor, 64/82, North Car Street, Chidambaram, Cuddalore - 608 001, Tamil Nadu, India'
 WHERE setting_key = 'contact.address'
   AND setting_value = 'JB Decor, 64/82, North Car Street, Chidambaram, Cuddalore - 608 001';
