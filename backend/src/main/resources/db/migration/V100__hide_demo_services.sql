-- Hide the demo website services seeded by DataSeeder so only the real JB Decor services (V96) show.
-- Soft only: rows are deactivated, not deleted, so any of them can be switched back on from
-- CRM › Website › Services. Services added later from the CRM are untouched.
UPDATE services
   SET active = b'0'
 WHERE slug IN ('interior-design', 'modular-kitchen', 'wardrobe-design', 'lighting-design',
                'false-ceiling', 'turnkey-interiors');
