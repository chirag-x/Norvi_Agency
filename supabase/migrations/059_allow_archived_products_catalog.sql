-- 059_allow_archived_products_catalog.sql
-- Allow anonymous visitors and authenticated customers to read both published and archived products
-- so that archived products remain discoverable on the storefront with sales paused.

DROP POLICY IF EXISTS published_products ON public.products;
CREATE POLICY published_products ON public.products 
  FOR SELECT TO anon, authenticated 
  USING (status IN ('published', 'archived'));
