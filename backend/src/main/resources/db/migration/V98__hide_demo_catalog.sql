-- Hide the original demo catalog now that the real JB Decor catalog (V96) is live. Soft only:
-- rows are deactivated, not deleted, so any of them can be switched back on from the CRM Website
-- module. Products are hidden too because the public product list/featured feed doesn't filter
-- by category, so demo items would otherwise still surface on the home page.
UPDATE shop_products p
  JOIN shop_categories c ON c.id = p.category_id
   SET p.active = b'0'
 WHERE c.slug IN ('furniture', 'lighting', 'decor', 'wallpaper', 'kitchen-accessories',
                  'wardrobes', 'bathroom', 'dining', 'office');

UPDATE shop_categories
   SET active = b'0'
 WHERE slug IN ('furniture', 'lighting', 'decor', 'wallpaper', 'kitchen-accessories',
                'wardrobes', 'bathroom', 'dining', 'office');
