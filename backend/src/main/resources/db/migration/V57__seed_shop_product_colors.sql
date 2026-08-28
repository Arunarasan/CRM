-- Give the 8 seeded shop products a set of colour/finish options so the public site shows
-- live swatches (instead of the frontend seed fallback). Non-destructive: only fills rows where
-- colors_json is still empty, so colours later edited from the CRM are never overwritten.
-- The two flagship pieces carry per-colour images so picking a swatch swaps the hero photo.

UPDATE shop_products SET colors_json =
  '[{"name":"Antique Gold","hex":"#c8a24a","image":"https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=80"},{"name":"Brushed Brass","hex":"#b08d57","image":"https://images.unsplash.com/photo-1550581190-9c1c48d21d6c?auto=format&fit=crop&w=800&q=80"},{"name":"Polished Chrome","hex":"#c9ccd1","image":"https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80"}]'
  WHERE slug = 'crystal-gold-chandelier' AND (colors_json IS NULL OR colors_json = '');

UPDATE shop_products SET colors_json =
  '[{"name":"Forest Green","hex":"#1f3d2b","image":"https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80"},{"name":"Royal Blue","hex":"#26456e","image":"https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80"},{"name":"Blush Pink","hex":"#d8a7a1","image":"https://images.unsplash.com/photo-1533090161767-e6ffed986c88?auto=format&fit=crop&w=800&q=80"},{"name":"Charcoal","hex":"#2e2e2e","image":"https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80"}]'
  WHERE slug = 'luxury-velvet-chair' AND (colors_json IS NULL OR colors_json = '');

UPDATE shop_products SET colors_json =
  '[{"name":"Carrara White","hex":"#eae7e0"},{"name":"Nero Marquina","hex":"#23211f"},{"name":"Emerald","hex":"#1f5c48"}]'
  WHERE slug = 'marble-coffee-table' AND (colors_json IS NULL OR colors_json = '');

UPDATE shop_products SET colors_json =
  '[{"name":"Ivory","hex":"#efe9db"},{"name":"Charcoal","hex":"#2e2e2e"},{"name":"Terracotta","hex":"#c26b4a"}]'
  WHERE slug = 'designer-table-lamp' AND (colors_json IS NULL OR colors_json = '');

UPDATE shop_products SET colors_json =
  '[{"name":"Ivory Boucle","hex":"#efe9db"},{"name":"Sand","hex":"#d8c7a8"},{"name":"Slate Grey","hex":"#6b7078"}]'
  WHERE slug = 'ivory-boucle-sofa' AND (colors_json IS NULL OR colors_json = '');

UPDATE shop_products SET colors_json =
  '[{"name":"Walnut","hex":"#5a3a22"},{"name":"Natural Oak","hex":"#b08d57"},{"name":"Matte Black","hex":"#1c1c1c"}]'
  WHERE slug = 'walnut-display-sideboard' AND (colors_json IS NULL OR colors_json = '');

UPDATE shop_products SET colors_json =
  '[{"name":"Matte White","hex":"#efe9db"},{"name":"Sage","hex":"#9aa88f"},{"name":"Ochre","hex":"#c9a24b"}]'
  WHERE slug = 'sculpted-ceramic-vase' AND (colors_json IS NULL OR colors_json = '');

UPDATE shop_products SET colors_json =
  '[{"name":"Tan Leather","hex":"#a4703c"},{"name":"Black Leather","hex":"#1c1c1c"},{"name":"Oxblood","hex":"#5e2129"}]'
  WHERE slug = 'executive-leather-desk-chair' AND (colors_json IS NULL OR colors_json = '');
