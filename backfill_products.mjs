import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envLocal = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const SUPABASE_URL = envLocal.match(/^SUPABASE_URL=(.*)$/m)?.[1];
const SUPABASE_SERVICE_ROLE_KEY = envLocal.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m)?.[1];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const productsToUpdate = [
  {
    slug: 'omnix',
    tagline: 'Speak your next task into action.',
    icon: 'workflow',
    color: 'lime',
    features: [
      'Voice-first task instructions',
      'Task planning and computer interaction',
      'Release scope under development'
    ],
    version: 'In development',
    requirements: 'Supported operating systems and hardware requirements to be confirmed.',
    release_status: 'development'
  },
  {
    slug: 'voro',
    tagline: 'Bring context to your interview preparation.',
    icon: 'message',
    color: 'blue',
    features: [
      'Screen and audio context',
      'Résumé and conversation memory',
      'Local and cloud AI options',
      'Coding assistance'
    ],
    version: 'Release version to be confirmed',
    requirements: 'Windows-oriented application. Supported Windows versions, audio setup, and local-model hardware requirements need verification.',
    release_status: 'prelaunch'
  },
  {
    slug: 'rolvio',
    tagline: 'Your next role, with less routine.',
    icon: 'sparkles',
    color: 'purple',
    features: [
      'Job discovery and résumé-fit scoring',
      'Application workflow and duplicate detection',
      'Email response tracking',
      'Kanban application dashboard'
    ],
    version: 'Release version to be confirmed',
    requirements: 'Python application with a browser-driven workflow. Packaged installer, supported systems, AI provider setup, and email requirements to be confirmed.',
    release_status: 'prelaunch'
  }
];

async function updateProducts() {
  for (const product of productsToUpdate) {
    const { error } = await supabase
      .from('products')
      .update({
        tagline: product.tagline,
        icon: product.icon,
        color: product.color,
        features: product.features,
        version: product.version,
        requirements: product.requirements,
        release_status: product.release_status
      })
      .eq('slug', product.slug);
    
    if (error) {
      console.error(`Failed to update ${product.slug}:`, error.message);
    } else {
      console.log(`Updated ${product.slug} successfully.`);
    }
  }
}

updateProducts();
