-- 061_agent_extended_content.sql
-- Adds extended_content JSONB for multi-agent dynamic landing page customization,
-- media galleries (videos/GIFs/images), comparison tables, platform badges, FAQs, and SEO.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS extended_content jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 1. Update public.admin_upsert_product to accept and save p_extended_content
CREATE OR REPLACE FUNCTION public.admin_upsert_product(
  p_id uuid, p_slug text, p_name text, p_category_id uuid, p_tagline text, p_description text,
  p_price_label text, p_status text, p_logo_url text, p_features text[], p_version text,
  p_requirements text, p_release_status text, p_workflow_heading text,
  p_workflow_description text, p_workflow_media_url text, p_workflow_note text,
  p_price_1m numeric DEFAULT 0, p_price_3m numeric DEFAULT 0, p_price_lifetime numeric DEFAULT 999,
  p_ai_usage text DEFAULT NULL, p_device_allowance text DEFAULT NULL,
  p_extended_content jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_product_id uuid;
BEGIN
  PERFORM private.require_staff(array['owner','administrator','product_manager']);
  IF p_status NOT IN ('draft','published','archived') OR p_release_status NOT IN ('development','prelaunch','live') THEN 
    RAISE EXCEPTION 'Invalid product status.'; 
  END IF;

  v_product_id := coalesce(p_id, gen_random_uuid());

  INSERT INTO public.products(
    id, slug, name, category_id, tagline, description, price_label, status, 
    logo_url, features, version, requirements, release_status, 
    workflow_heading, workflow_description, workflow_media_url, workflow_note,
    price_1m, price_3m, price_lifetime, ai_usage, device_allowance, extended_content
  )
  VALUES (
    v_product_id, p_slug, p_name, p_category_id, p_tagline, p_description, p_price_label, p_status, 
    p_logo_url, coalesce(p_features, '{}'), p_version, p_requirements, p_release_status, 
    p_workflow_heading, p_workflow_description, p_workflow_media_url, p_workflow_note,
    p_price_1m, p_price_3m, p_price_lifetime, p_ai_usage, p_device_allowance, coalesce(p_extended_content, '{}'::jsonb)
  )
  ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug, name = EXCLUDED.name, category_id = EXCLUDED.category_id,
    tagline = EXCLUDED.tagline, description = EXCLUDED.description, price_label = EXCLUDED.price_label,
    status = EXCLUDED.status, logo_url = EXCLUDED.logo_url, features = EXCLUDED.features,
    version = EXCLUDED.version, requirements = EXCLUDED.requirements, release_status = EXCLUDED.release_status,
    workflow_heading = EXCLUDED.workflow_heading, workflow_description = EXCLUDED.workflow_description,
    workflow_media_url = EXCLUDED.workflow_media_url, workflow_note = EXCLUDED.workflow_note,
    price_1m = EXCLUDED.price_1m, price_3m = EXCLUDED.price_3m, price_lifetime = EXCLUDED.price_lifetime,
    ai_usage = EXCLUDED.ai_usage, device_allowance = EXCLUDED.device_allowance,
    extended_content = coalesce(EXCLUDED.extended_content, public.products.extended_content, '{}'::jsonb),
    revision = public.products.revision + 1;

  INSERT INTO private.audit_log(actor_id, action, target_id) VALUES(auth.uid(), 'product.saved', p_slug);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_product(uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_product(uuid, text, text, uuid, text, text, text, text, text, text[], text, text, text, text, text, text, text, numeric, numeric, numeric, text, text, jsonb) TO authenticated;

-- 2. Update admin_list_products to return extendedContent
CREATE OR REPLACE FUNCTION public.admin_list_products()
RETURNS json language plpgsql security definer set search_path='' as $$
declare v_items json; v_categories json;
begin
  perform private.require_staff(array['owner','administrator','product_manager']);
  select coalesce(json_agg(json_build_object(
    'id',p.id,'slug',p.slug,'name',p.name,'categoryId',p.category_id,
    'category',case when c.id is null then null else json_build_object('id',c.id,'slug',c.slug,'name',c.name) end,
    'tagline',p.tagline,'description',p.description,'price',p.price_label,
    'price1m',p.price_1m,'price3m',p.price_3m,'price_lifetime',p.price_lifetime,
    'status',p.status,
    'logoUrl',p.logo_url,'features',p.features,'version',p.version,'requirements',p.requirements,
    'releaseStatus',p.release_status,'workflowHeading',p.workflow_heading,
    'workflowDescription',p.workflow_description,'workflowMediaUrl',p.workflow_media_url,
    'workflowNote',p.workflow_note,'updatedAt',p.created_at,
    'is_on_sale',p.is_on_sale,
    'aiUsage',p.ai_usage, 'deviceAllowance',p.device_allowance,
    'trialActive',p.trial_active,
    'extendedContent',coalesce(p.extended_content, '{}'::jsonb)
  ) order by p.created_at), '[]'::json) into v_items
  from public.products p left join public.categories c on c.id=p.category_id
  WHERE p.status != 'deleted';
  
  select coalesce(json_agg(json_build_object('id',id,'slug',slug,'name',name,'createdAt',created_at) order by created_at),'[]'::json)
    into v_categories from public.categories;
    
  return json_build_object('items', v_items, 'categories', v_categories);
end;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_products() TO authenticated;

-- 3. Optional initial seed for existing Voro and Rolvio agents if extended_content is empty
UPDATE public.products
SET extended_content = '{
  "badgeText": "⚡ Ultra-Low Latency | 100% Undetectable | Local & Cloud AI",
  "platformBadges": ["Zoom", "Microsoft Teams", "Google Meet", "HackerRank", "LeetCode", "CoderPad"],
  "featurePillars": [
    {
      "id": "voro-p1",
      "title": "Hardware-Routed Audio Stealth",
      "tag": "Undetectable",
      "icon": "ShieldCheck",
      "description": "Bypasses Windows Media Foundation capture hooks. Audio routes directly to your private earpiece so no call participants ever hear it."
    },
    {
      "id": "voro-p2",
      "title": "Screen-Aware Multimodal OCR",
      "tag": "Live Vision",
      "icon": "ScanEye",
      "description": "Reads coding problems, diagrams, and formulas directly off your active screen in real-time."
    },
    {
      "id": "voro-p3",
      "title": "Résumé & Coding Copilot",
      "tag": "Tailored Answers",
      "icon": "Bot",
      "description": "Tailors generated answers to your exact background, past projects, and solves live coding challenges with optimal time complexity."
    }
  ],
  "comparison": {
    "headline": "Why Voro Outperforms the Alternatives",
    "competitor1Name": "Parakeet.ai",
    "competitor2Name": "ChatGPT / Web AI",
    "rows": [
      { "feature": "Invisible on Screen Share", "us": true, "comp1": true, "comp2": false },
      { "feature": "Hardware Audio Bypass", "us": true, "comp1": false, "comp2": false },
      { "feature": "100% Offline / Local Execution", "us": true, "comp1": false, "comp2": false },
      { "feature": "Pricing Model", "us": "From ₹499 / Lifetime", "comp1": "$149.90 / month", "comp2": "$20 / month" },
      { "feature": "LeetCode & Code Assistant", "us": true, "comp1": true, "comp2": true }
    ]
  },
  "workflowSteps": [
    { "step": "01", "title": "Launch & Enter Key", "description": "Open Voro on your Windows PC. It silently sits in your system tray." },
    { "step": "02", "title": "Load Context", "description": "Paste your target job description or résumé so answers are tailored to your real experience." },
    { "step": "03", "title": "Join Meeting", "description": "Open Zoom, Teams, or HackerRank. Voro listens and projects instant answers to your private HUD." }
  ],
  "faqs": [
    { "question": "Will Zoom, Teams, or Google Meet detect Voro?", "answer": "No. Voro utilizes hardware-level overlay layering that is completely invisible to screen-sharing capture software." },
    { "question": "Can interviewers hear Voro voice output?", "answer": "No. Voro routes audio exclusively to your selected headphone output, bypassing Windows recording hooks." },
    { "question": "Can I use my own Gemini or OpenAI API keys?", "answer": "Yes. Voro supports Bring-Your-Own-Key (BYOK) for zero token markups, as well as 100% offline local models (Ollama)." }
  ],
  "seo": {
    "metaTitle": "Voro - #1 Real-Time AI Interview Assistant & Coding Copilot | Undetectable",
    "metaDescription": "Nail your live interviews with Voro: the #1 real-time AI interview assistant with screen awareness, invisible audio routing, and live coding support. Try free.",
    "focusKeywords": "interview assistant agent, real time ai interview assistant, ai interview copilot, leetcode ai helper, parakeet ai alternative, voro ai"
  }
}'::jsonb
WHERE slug = 'voro' AND (extended_content IS NULL OR extended_content = '{}'::jsonb);

UPDATE public.products
SET extended_content = '{
  "badgeText": "🚀 Automated Applications | Resume Matching | Smart Follow-up",
  "platformBadges": ["LinkedIn", "Indeed", "Wellfound", "Glassdoor", "ZipRecruiter"],
  "featurePillars": [
    {
      "id": "rolvio-p1",
      "title": "Smart Resume Matching",
      "tag": "High ATS Fit",
      "icon": "Bot",
      "description": "Analyzes job descriptions and matches your resume skills with precision before applying."
    },
    {
      "id": "rolvio-p2",
      "title": "Browser-Driven Auto-Apply",
      "tag": "Hands-Free",
      "icon": "Zap",
      "description": "Automatically fills applications, answers custom screening questions, and bypasses duplicate job posts."
    },
    {
      "id": "rolvio-p3",
      "title": "Response & Follow-up Tracking",
      "tag": "Kanban",
      "icon": "Layers",
      "description": "Monitors interview invitations and recruiter emails in a visual status board."
    }
  ],
  "comparison": {
    "headline": "Why Rolvio Outperforms Job Bots",
    "competitor1Name": "LazyApply",
    "competitor2Name": "Manual Applying",
    "rows": [
      { "feature": "Smart Question Answering", "us": true, "comp1": false, "comp2": true },
      { "feature": "Duplicate Application Guard", "us": true, "comp1": false, "comp2": false },
      { "feature": "Email Response Tracking", "us": true, "comp1": false, "comp2": false },
      { "feature": "Pricing Model", "us": "From ₹499 / Lifetime", "comp1": "$250 / lifetime", "comp2": "Hours of daily work" }
    ]
  },
  "workflowSteps": [
    { "step": "01", "title": "Profile Setup", "description": "Add your resume, target titles, locations, and salary expectations." },
    { "step": "02", "title": "Review Matches", "description": "Rolvio discovers verified jobs and calculates ATS match scores." },
    { "step": "03", "title": "Automated Submissions", "description": "Rolvio applies cleanly through your browser with human-like interactions." }
  ],
  "faqs": [
    { "question": "Can job platforms detect automated applications?", "answer": "Rolvio mimics natural human typing patterns, mouse movements, and variable delays to safeguard your accounts." },
    { "question": "Can I review applications before they are sent?", "answer": "Yes. You can run Rolvio in full auto mode or semi-autonomous review mode where it pauses for your approval." }
  ],
  "seo": {
    "metaTitle": "Rolvio - AI Automated Job Applicant & Career Assistant | NORVI",
    "metaDescription": "Automate your job search with Rolvio. Smart resume matching, automated job applications on LinkedIn and Indeed, and email response tracking.",
    "focusKeywords": "automation for applying job, job apply agent, automated job application, auto apply linkedin, rolvio ai"
  }
}'::jsonb
WHERE slug = 'rolvio' AND (extended_content IS NULL OR extended_content = '{}'::jsonb);

