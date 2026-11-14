const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// 1. Read catalog.json
const catalogPath = 'packages/shared/catalog.json';
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// Update Voro in catalog
const voro = catalog.products.find(p => p.slug === 'voro' || p.id === '00000000-0000-4000-8000-000000000002');
if (voro) {
  voro.workflowNote = 'Windows 10/11 native installer. Includes automatic silent background updater and ultra-low latency NORVI Cloud AI.';
  voro.aiUsage = 'Unlimited — Powered by NORVI Cloud AI';
  if (voro.extendedContent) {
    voro.extendedContent.badgeText = '⚡ Ultra-Low Latency | 100% Undetectable | Cloud AI Included';
    if (voro.extendedContent.faqs) {
      voro.extendedContent.faqs.forEach(f => {
        if (f.question.includes('record or store my interview sessions')) {
          f.answer = 'Absolutely not. Norvi Agency enforces a strict zero-data-logging architecture. Voro captures your screen and routes audio natively on your machine, while AI reasoning queries are encrypted and processed through NORVI Cloud AI with zero tracking, logging, or audio storage.';
        }
      });
    }
    // Update guide sections for Voro
    voro.extendedContent.guide = {
      sections: [
        {
          id: 'section-voro-step-1',
          heading: 'Download & Install Voro',
          content: '1. In your NORVI Dashboard (https://nor-vi.in/account/agents), click the "Download Installer" button next to Voro to get the official setup file (Voro_Setup.exe).\n2. Open the downloaded file and follow the standard on-screen Windows installer steps.\n3. Once installed, launch Voro from your desktop shortcut or Windows Start menu.',
          imageUrl: null
        },
        {
          id: 'section-voro-step-2',
          heading: 'Activate Your License Key',
          content: '1. On your NORVI Dashboard, find Voro and click "View License".\n2. Copy your unique activation key (starts with NORVI-VORO-).\n3. In the Voro application, paste your license key and click "Activate". Your license is verified immediately through the NORVI security gateway, giving you full access.',
          imageUrl: null
        },
        {
          id: 'section-voro-step-3',
          heading: 'Instant Cloud AI Brain (Zero Setup Needed)',
          content: 'Unlike older tools that require you to configure Ollama, install Python, or download massive 10GB models, Voro connects to the NORVI Cloud AI brain automatically.\n• Real-time interview reasoning, coding solutions, and answer distillation are 100% active immediately.\n• Zero GPU requirements and minimal system resource usage—runs smoothly on standard laptops.\n• Check your operational status at any time in Voro Settings → System Readiness Summary.',
          imageUrl: null
        },
        {
          id: 'section-voro-step-4',
          heading: 'Connect Fast Voice Recognition (~200ms Latency)',
          content: 'For ultra-fast ~200ms speech recognition, connect your free personal Groq API key:\n1. Inside Voro, open Settings → Audio tab.\n2. In Section 3 (Voice Recognition), click "Get Free Key" (or visit https://console.groq.com/keys).\n3. Sign up or log in (100% free with Google, no card required).\n4. Click "Create API Key", name it "Voro", and copy your key (starts with "gsk_...").\n5. Paste it into the "Groq API Key" field in Voro and click "⚡ Test Key".\n(Note: If you ever interview offline without internet, simply select an offline model from the dropdown and click "Download" for zero-internet backup).',
          imageUrl: null
        },
        {
          id: 'section-voro-step-5',
          heading: 'Personalize Answers with Your Resume & Target Job',
          content: 'Make your answers sound completely natural and grounded in your real background:\n1. Open Voro Settings → Profile tab.\n2. Paste your Resume / Work History detailing your past projects, tech stack, and experience.\n3. Paste the target Job Description of the role you are interviewing for.\n4. Click "Save Settings". Voro will now frame all behavioral and technical answers using your genuine past experience.',
          imageUrl: null
        },
        {
          id: 'section-voro-step-6',
          heading: 'Meeting Setup & Live Interview Hotkeys',
          content: 'Prepare your meeting audio and control Voro effortlessly with keyboard shortcuts:\n• Private Headphone Audio: In Settings → Audio, select your headphones/earpiece as the output device so only you hear Voro\'s voice.\n• 100% Invisible Screen Share: Voro uses Windows hardware display isolation (SetWindowDisplayAffinity) and is completely invisible to Zoom, Teams, and Google Meet even when sharing your entire desktop.\n• Key Shortcuts:\n  - Ctrl + Enter: Push-to-Answer (answers the technical question while filtering small talk).\n  - Ctrl + Shift + U: Toggle Auto-Answer (hands-free automatic answers).\n  - Ctrl + Shift + Q: Screen Vision (reads LeetCode/IDE code on screen and generates clean code + Big-O analysis).\n  - Ctrl + Shift + G: Emergency Stealth Cloak (instantly hides Voro in under 20ms).',
          imageUrl: null
        }
      ],
      videoUrl: null
    };
  }
}

// Update Nexus in catalog
const nexus = catalog.products.find(p => p.slug === 'nexus' || p.id === '95f45701-8083-4336-bd42-e7d28a2bce47');
if (nexus) {
  nexus.workflowDescription = "Setting up your automated content pipeline with Nexus is effortless. First, use the 'Discover' tab to search for viral long-form videos by niche, duration, or direct URL. Second, let the 'Clip Lab' use NORVI Cloud AI to instantly identify engaging highlights, auto-crop them for vertical viewing, and generate precise captions. Finally, head to the 'Publishing Queue' to let the AI write your titles and hashtags, pick your platforms, and set a schedule. The Nexus background daemon will handle the rest, silently publishing your content at the exact right time while you relax.";
  nexus.aiUsage = 'Unlimited — Powered by NORVI Cloud AI';
  if (nexus.extendedContent) {
    nexus.extendedContent.badgeText = '⚡ Native Desktop Performance | Autonomous 24/7 Publishing Daemon | All AI Models & Tokens Included';
  }
}

// Save updated catalog.json
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log('Successfully updated packages/shared/catalog.json');

// 2. Synchronize to Supabase products table
async function syncToSupabase() {
  if (voro) {
    const { error: vErr } = await supabase.from('products').update({
      workflow_note: voro.workflowNote,
      ai_usage: voro.aiUsage,
      extended_content: voro.extendedContent
    }).eq('id', voro.id);
    if (vErr) console.error('Error updating Voro in Supabase:', vErr);
    else console.log('Successfully updated Voro in Supabase products table');
  }

  if (nexus) {
    const { error: nErr } = await supabase.from('products').update({
      workflow_description: nexus.workflowDescription,
      ai_usage: nexus.aiUsage,
      extended_content: nexus.extendedContent
    }).eq('id', nexus.id);
    if (nErr) console.error('Error updating Nexus in Supabase:', nErr);
    else console.log('Successfully updated Nexus in Supabase products table');
  }
}

syncToSupabase();
