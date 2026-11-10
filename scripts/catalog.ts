import { readFile, writeFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { seed, settings as defaultSettings, type Store } from '../packages/shared/model';

const CATALOG_FILE = 'packages/shared/catalog.json';

async function writeSnapshot(snapshot: string) {
  let previous = '';
  try {
    previous = await readFile(CATALOG_FILE, 'utf8');
  } catch {}
  if (previous !== snapshot) {
    await writeFile(CATALOG_FILE, snapshot, 'utf8');
  }
}

export async function writeCatalog(data: Store) {
  // Only approved public fields enter the frontend snapshot. Never copy users, orders, or keys.
  const defaults = seed();
  const categories = data.categories || defaults.categories;
  const products = data.products.map(product => {
    const fallback = defaults.products.find(item => item.id === product.id);
    const merged = fallback ? { ...fallback, ...product } : { ...product };
    if (typeof (merged as any).category === 'string') {
      const catMatch = categories.find(c => c.id === merged.categoryId || c.name === (merged as any).category);
      if (catMatch) (merged as any).category = catMatch;
    }
    return merged;
  });
  const snapshot =
    JSON.stringify(
      {
        categories,
        products: products.filter(p => p.status === 'published' || p.status === 'archived'),
        settings: { ...defaults.settings, ...data.settings }
      },
      null,
      2
    ) + '\n';
  await writeSnapshot(snapshot);
}

async function fetchLivePublicCatalog(): Promise<boolean> {
  const url = (process.env.SUPABASE_URL || '').trim();
  const anonKey = (process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !anonKey || url.includes('YOUR_') || anonKey.includes('YOUR_')) {
    return false;
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const [productsResult, settingsResult, categoriesResult] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, slug, name, categoryId:category_id, tagline, description, price:price_label, price1m:price_1m, price3m:price_3m, price_lifetime:price_lifetime, status, logoUrl:logo_url, features, version, requirements, releaseStatus:release_status, workflowHeading:workflow_heading, workflowDescription:workflow_description, workflowMediaUrl:workflow_media_url, workflowNote:workflow_note, aiUsage:ai_usage, deviceAllowance:device_allowance, is_on_sale, trialActive:trial_active, extendedContent:extended_content'
      )
      .in('status', ['published', 'archived'])
      .order('created_at', { ascending: true }),
    supabase
      .from('site_settings')
      .select(
        'name, headline, description, email, company, domain, maintenance_mode, permissions, banner_text, sale_active, sale_percentage, socialInstagram:social_instagram, socialYoutube:social_youtube, socialFacebook:social_facebook, socialTwitter:social_twitter'
      )
      .single(),
    supabase.from('categories').select('id, slug, name, createdAt:created_at')
  ]);

  if (productsResult.error || !Array.isArray(productsResult.data)) {
    throw new Error(productsResult.error?.message || 'Failed to fetch public products');
  }

  const defaults = seed();
  const categories =
    !categoriesResult.error && Array.isArray(categoriesResult.data) && categoriesResult.data.length > 0
      ? categoriesResult.data
      : defaults.categories;

  const products = productsResult.data.map(p => ({
    ...p,
    extendedContent: (p as any).extendedContent || {},
    category: categories.find(c => c.id === p.categoryId) || null
  }));

  const rawSettings = !settingsResult.error ? settingsResult.data : null;
  const permissions =
    rawSettings?.permissions && Object.keys(rawSettings.permissions).length > 0
      ? rawSettings.permissions
      : defaultSettings.permissions;

  const settings = rawSettings
    ? {
        ...defaults.settings,
        name: rawSettings.name || defaults.settings.name,
        headline: rawSettings.headline || defaults.settings.headline,
        description: rawSettings.description || defaults.settings.description,
        email: rawSettings.email || defaults.settings.email,
        company: rawSettings.company || defaults.settings.company,
        domain: rawSettings.domain || defaults.settings.domain,
        maintenanceMode: !!rawSettings.maintenance_mode,
        permissions,
        bannerText: rawSettings.banner_text || '',
        saleActive: !!rawSettings.sale_active,
        salePercentage: rawSettings.sale_percentage ?? 0,
        socialInstagram: rawSettings.socialInstagram || '',
        socialYoutube: rawSettings.socialYoutube || '',
        socialFacebook: rawSettings.socialFacebook || '',
        socialTwitter: rawSettings.socialTwitter || ''
      }
    : defaults.settings;

  const snapshot = JSON.stringify({ categories, products, settings }, null, 2) + '\n';
  await writeSnapshot(snapshot);
  console.log(`[sync-catalog] Synced ${products.length} live product(s) from Supabase.`);
  return true;
}

export async function syncCatalog() {
  try {
    loadEnvFile('.env.local');
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const explicitPreview = process.env.NORVI_MODE === 'preview';
  if (!explicitPreview) {
    try {
      const synced = await fetchLivePublicCatalog();
      if (synced) return;
    } catch (err: any) {
      console.warn('[sync-catalog] Live Supabase sync failed, falling back cleanly:', err?.message || err);
      try {
        await readFile(CATALOG_FILE, 'utf8');
        return;
      } catch {}
    }
  }

  let data: Store;
  try {
    data = JSON.parse(await readFile('.local/preview.json', 'utf8'));
  } catch (e: any) {
    if (e.code !== 'ENOENT') throw e;
    data = seed();
  }
  await writeCatalog(data);
}
