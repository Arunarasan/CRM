-- List the real JB Decor catalog categories (V96, display_order 1..8) ahead of the original demo
-- categories, which shared the same 1..10 ordering and interleaved with them. "curtains" existed
-- before V96 (the import reused it), so it is pinned explicitly. Only demo rows still in the low
-- range are shifted, so orders set later from the CRM Website module are left alone.
UPDATE shop_categories
   SET display_order = display_order + 100
 WHERE slug NOT IN ('netlon-mosquito-nets', 'curtains', 'blinds', 'curtain-rods-accessories',
                    'mats-flooring', 'wall-decor', 'interior-works', 'home-decor')
   AND display_order < 100;

UPDATE shop_categories SET display_order = 2 WHERE slug = 'curtains' AND display_order IN (4, 104);
