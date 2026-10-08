-- Create promotional content table
CREATE TABLE IF NOT EXISTS public.partner_promotional_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_promotional_content ENABLE ROW LEVEL SECURITY;

-- Allow public read access (partners will be able to see it)
CREATE POLICY "Allow public read of promotional content" 
    ON public.partner_promotional_content FOR SELECT 
    USING (true);

-- Allow admin only to modify
CREATE POLICY "Allow admin to modify promotional content" 
    ON public.partner_promotional_content FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_memberships 
            WHERE staff_memberships.user_id = auth.uid() 
            AND staff_memberships.role IN ('owner', 'administrator', 'product_manager') 
            AND staff_memberships.active = true
        )
    );

-- Create storage bucket for promotions
INSERT INTO storage.buckets (id, name, public) 
VALUES ('promotions', 'promotions', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for promotions bucket
CREATE POLICY "Public read promotions" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'promotions');

CREATE POLICY "Admin manage promotions" 
    ON storage.objects FOR ALL 
    USING (
        bucket_id = 'promotions' AND
        EXISTS (
            SELECT 1 FROM public.staff_memberships 
            WHERE staff_memberships.user_id = auth.uid() 
            AND staff_memberships.role IN ('owner', 'administrator', 'product_manager') 
            AND staff_memberships.active = true
        )
    );
