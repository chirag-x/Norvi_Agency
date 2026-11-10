import json
import os

catalog_path = r'e:\Agency\packages\shared\catalog.json'

with open(catalog_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for p in data['products']:
    if p.get('slug') == 'rolvio':
        p['name'] = 'Rolvio'
        p['tagline'] = 'The Autonomous AI Career Agent & Desktop Job-Search Engine'
        p['description'] = 'An end-to-end autonomous AI career agent that automates your entire job hunt. Features local AI resume parsing, ATS skill matching, stealth multi-platform auto-applying across LinkedIn, Indeed, Naukri, Internshala, and Wellfound, strict DOM verification, and background IMAP email interview tracking.'
        p['price'] = '₹499'
        p['price1m'] = '499'
        p['price3m'] = '999'
        p['price_lifetime'] = '1999'
        p['releaseStatus'] = 'live'
        p['version'] = 'v1.0.0 Stable'
        p['requirements'] = 'Windows 10/11 64-bit, 8GB RAM, Google Chrome / Chromium. Optional: Ollama for 100% offline local AI execution.'
        p['aiUsage'] = 'Unlimited local offline execution via Ollama (Llama 3, Gemma 2), or Bring-Your-Own Gemini/OpenAI API keys.'
        p['deviceAllowance'] = '1 active desktop device per license. Manage and release devices instantly in your NORVI dashboard.'
        p['features'] = [
            'Multi-Platform Stealth Auto-Apply (LinkedIn, Indeed, Naukri, Internshala, Wellfound)',
            'Local AI Resume Parsing & ATS Match Scoring (Ollama / Gemini / OpenAI)',
            'Intelligent Dynamic CTC, Notice Period & Screening Question Engine',
            'Zero-False-Positive DOM-Level Proof of Submission Verification',
            'Automated IMAP Recruiter Response & Interview Radar',
            'Dark-Mode Mission Control Kanban Dashboard'
        ]
        p['workflowHeading'] = 'Autonomous career automation, from discovery to interview.'
        p['workflowDescription'] = 'Rolvio operates silently on your desktop. It discovers high-match jobs across 5 platforms, uses local AI to answer screening questions with precision, submits applications using stealth browser automation, and tracks recruiter interview invites in a real-time Kanban board.'
        p['workflowNote'] = 'Includes native Windows installer, automatic updates, and SQLite local encrypted answer vault.'
        
        ext = p.setdefault('extendedContent', {})
        ext['badgeText'] = '⚡ 100% Stealth Playwright | Local Ollama AI | 5 Global Job Platforms'
        ext['platformBadges'] = ['LinkedIn', 'Indeed', 'Naukri', 'Internshala', 'Wellfound', 'Google Chrome', 'Windows 11']
        ext['featurePillars'] = [
            {
                'id': 'rolvio-p1',
                'title': 'Local AI Brain & ATS Precision Fit Scorer',
                'tag': 'Zero Token Cost & 100% Private',
                'icon': 'Bot',
                'description': 'Powered by local Ollama LLMs (Llama 3, Gemma 2) or cloud AI. Rolvio ingests your master resume, analyzes every scraped job description, scores compatibility out of 100, and tailors screening answers to your real experience.'
            },
            {
                'id': 'rolvio-p2',
                'title': 'Stealth Playwright Multi-Platform Engine',
                'tag': 'Anti-Bot Resilient',
                'icon': 'Shield',
                'description': 'Bypasses detection by running directly in your authenticated browser sessions across LinkedIn, Indeed, Naukri, Internshala, and Wellfound. Employs human typing cadence, bezier curve mouse jitter, and automated session recovery.'
            },
            {
                'id': 'rolvio-p3',
                'title': 'Strict DOM Verification & Memory Vault',
                'tag': 'Zero False Positives',
                'icon': 'Zap',
                'description': 'No hallucinated submissions. Rolvio strictly verifies confirmation dialogs, post-submission URLs, and dismiss prompts before marking an application sent. Persists answers in a local SQLite memory vault to prevent duplicate submissions.'
            },
            {
                'id': 'rolvio-p4',
                'title': 'Mission Control Kanban & IMAP Interview Radar',
                'tag': 'Inbox Automation',
                'icon': 'Layers',
                'description': 'Never update a spreadsheet again. Rolvio monitors your email inbox via secure IMAP, extracts recruiter replies, categorizes coding tests and interview invitations, and advances job cards dynamically across a visual Kanban board.'
            }
        ]
        ext['comparison'] = {
            'headline': 'Why Candidates Choose Rolvio Over Bot Extensions',
            'competitor1Name': 'LazyApply / Sonara',
            'competitor2Name': 'Manual Job Applications',
            'rows': [
                { 'feature': 'Custom Screening Question Handling', 'us': 'AI Context-Aware (Resume-Grounded)', 'comp1': 'Basic regex / Fails on complex forms', 'comp2': 'Tedious manual typing' },
                { 'feature': 'Submission Proof & Verification', 'us': 'Strict DOM Modal & Confirmation Check', 'comp1': 'Unverified button clicks', 'comp2': 'Manual visual verification' },
                { 'feature': 'AI Runtime & Privacy', 'us': '100% Offline Local Ollama or Cloud BYOK', 'comp1': 'Cloud-hosted (Data privacy risk)', 'comp2': 'N/A' },
                { 'feature': 'Platform Support', 'us': 'LinkedIn, Indeed, Naukri, Internshala, Wellfound', 'comp1': 'LinkedIn / Indeed only', 'comp2': 'All (Hours of tab switching)' },
                { 'feature': 'Inbox & Interview Radar', 'us': 'Automated IMAP Email Categorization', 'comp1': 'No email integration', 'comp2': 'Manual inbox checking' },
                { 'feature': 'Anti-Detection Protection', 'us': 'Native Playwright + Bezier Jitter & Human Delays', 'comp1': 'Standard Chrome extensions (Flagged easily)', 'comp2': 'Natural human' },
                { 'feature': 'Persistent Answer Memory', 'us': 'Local SQLite QA Vault (Learns & Deduplicates)', 'comp1': 'None', 'comp2': 'Copy-paste notes' },
                { 'feature': 'Pricing Model', 'us': 'From ₹499 / Lifetime Available (INR)', 'comp1': '$150 - $250 / month (USD)', 'comp2': 'Hours of daily unpaid labor' }
            ]
        }
        ext['workflowSteps'] = [
            { 'step': '01', 'title': 'Ingest Profile & Set Preferences', 'description': 'Upload your resume and set target job titles, locations, CTC range, and minimum ATS match score.' },
            { 'step': '02', 'title': 'Autonomous Radar & Scoring', 'description': 'Rolvio scans 5 platforms, extracts job specs, and uses local AI to score each role against your resume.' },
            { 'step': '03', 'title': 'Stealth Execution & Interview Tracking', 'description': 'Launch 1-click stealth auto-apply and let Rolvio handle applications and sync incoming recruiter interview emails to your Kanban.' }
        ]
        ext['faqs'] = [
            {
                'question': 'Will LinkedIn, Indeed, or Naukri detect or ban my account?',
                'answer': 'No. Unlike browser extensions that inject unsafe scripts into the DOM or headless cloud bots with datacenter IP addresses, Rolvio runs on your local desktop using Microsoft Playwright. It leverages your existing, authenticated browser session cookies and mimics natural human behavior—including randomized bezier mouse curves, variable typing delays (50–120ms per keystroke), and human-like inspection pauses. If a CAPTCHA ever appears, Rolvio pauses and alerts you to solve it naturally before resuming seamlessly.'
            },
            {
                'question': 'How does Rolvio handle complex screening questions like CTC, notice period, and experience?',
                'answer': 'Rolvio uses an intelligent dual-engine approach. For standard questions (notice period, current CTC, expected CTC, years of experience, legal authorization), it dynamically computes and formats the exact numerical or text answer based on your Master Profile. For subjective screening questions ("Why do you want to work here?", "Describe your experience with distributed systems"), Rolvio\'s AI Brain generates grounded answers strictly referencing your uploaded resume. All answers are cached in an encrypted local SQLite database so questions are never repeatedly re-prompted.'
            },
            {
                'question': 'Do I have to pay for costly AI API tokens?',
                'answer': 'No! Rolvio includes native support for 100% offline local LLMs via Ollama (such as Llama 3, Gemma 2, and Mistral). When running locally, all parsing, ATS scoring, and question answering execute entirely on your machine at zero token cost and complete data privacy. If you prefer cloud models, Rolvio also supports Bring-Your-Own-Key (BYOK) for Google Gemini and OpenAI with direct API calls and zero platform markup.'
            },
            {
                'question': 'Can I review and approve job applications before Rolvio submits them?',
                'answer': 'Yes. Rolvio features dual execution modes: "Review Queue Mode" and "1-Click Autonomous Stealth Mode". In Review Queue Mode, all matched jobs are queued in your Pending Review tab with ATS match scores, allowing you to approve, skip, or modify applications one-by-one. Once you trust the criteria, switch to Autonomous Mode and let Rolvio process your approved queue in the background while you focus on interview prep.'
            },
            {
                'question': 'How does Rolvio guarantee that an application was actually submitted?',
                'answer': 'Rolvio features strict, zero-false-positive DOM verification. Rather than merely clicking a "Submit" button and assuming success, Rolvio monitors the browser state to confirm submission modals, "Application Submitted" headers, post-submission redirect URLs, or dismiss confirmation dialogs. If an unexpected error or incomplete question blocks submission, the job is flagged for your review instead of being falsely recorded as applied.'
            },
            {
                'question': 'How does the IMAP email and interview tracking work?',
                'answer': 'Rolvio connects securely via standard IMAP to your job-search email inbox (e.g., Gmail, Outlook, Yahoo) using encrypted credentials or app passwords. Its background worker checks exclusively for new unread messages from recruiters. When an email arrives, the AI parses the sender, company name, and email context to determine if it is an interview invitation, a technical assessment, or a rejection—automatically updating the application status in your Mission Control Kanban board.'
            },
            {
                'question': 'Is my personal data, resume, and login credentials safe?',
                'answer': 'Completely. Rolvio is a privacy-first, desktop-native application. Your resumes, profile details, session cookies, application history, and API keys are stored locally on your machine in an encrypted SQLite database. NORVI does not harvest, store, or sell your personal career data.'
            },
            {
                'question': 'Can I transfer my Rolvio license to a new computer?',
                'answer': 'Yes. Every NORVI license includes hardware device management. If you switch or format your computer, simply log into your NORVI customer dashboard at nor-vi.in/account/licenses, click "Release device", and activate Rolvio on your new machine with your existing activation key.'
            }
        ]
        ext['seo'] = {
            'metaTitle': 'Rolvio - #1 Autonomous AI Job Hunter & Career Agent | Stealth Playwright',
            'metaDescription': 'Automate your job search with Rolvio: the #1 desktop AI job hunter. Stealth auto-apply across LinkedIn, Indeed, Naukri, Internshala & Wellfound with local Ollama AI & IMAP interview radar.',
            'focusKeywords': 'ai job applicant agent, automated job application, auto apply linkedin, indeed auto apply bot, rolvio ai, job hunt automation, playwright job applicant'
        }
        ext['guide'] = {
            'videoUrl': 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'sections': [
                {
                    'id': 'guide-step-1',
                    'heading': '1. Download & Install Rolvio Desktop',
                    'content': 'Download the official Rolvio Windows installer (.exe or .zip) from your NORVI dashboard under "My agents". Run the installer and launch Rolvio from your desktop shortcut or Start Menu.',
                    'imageUrl': None
                },
                {
                    'id': 'guide-step-2',
                    'heading': '2. Activate With Your NORVI License Key',
                    'content': 'On first launch, Rolvio will prompt you for your Product Activation Key. Navigate to nor-vi.in/account/licenses in your browser, click "Reveal key" next to Rolvio, copy your key (e.g., NORVI-XXXX-XXXX-XXXX-XXXX), and paste it into the application to link your device.',
                    'imageUrl': None
                },
                {
                    'id': 'guide-step-3',
                    'heading': '3. Choose Your AI Brain (Local Ollama or Cloud API)',
                    'content': 'Open Settings in Rolvio and select your AI provider:\n• Local AI (Recommended & Free): Ensure Ollama is installed (ollama.com) and run "ollama run gemma2" or "llama3". Select "Ollama" in Rolvio for 100% offline execution with zero API costs.\n• Cloud AI: Select "Gemini" or "OpenAI" and paste your personal API key for high-speed cloud intelligence.',
                    'imageUrl': None
                },
                {
                    'id': 'guide-step-4',
                    'heading': '4. Upload Resume & Build Your Master Profile',
                    'content': 'Go to the Profile tab. Click "Upload Resume" (PDF or DOCX). Rolvio\'s AI will parse your technical skills, work history, and contact details. Fill in your compensation parameters (Current CTC, Expected CTC), notice period, and preferred work arrangements (Remote, Hybrid, On-site). This profile serves as the single source of truth for screening questions.',
                    'imageUrl': None
                },
                {
                    'id': 'guide-step-5',
                    'heading': '5. Connect Your Job Platform Sessions',
                    'content': 'Go to the Platforms tab. Click "Connect" next to the platforms you want Rolvio to operate on (LinkedIn, Indeed, Naukri, Internshala, Wellfound). A secure browser window will open—simply log into your account normally. Rolvio captures and encrypts your session cookies locally, allowing it to apply under your verified identity without ever asking for your passwords.',
                    'imageUrl': None
                },
                {
                    'id': 'guide-step-6',
                    'heading': '6. Configure Job Discovery Radar & ATS Match Threshold',
                    'content': 'Go to the Radar tab. Add your target job titles (e.g., "Full Stack Developer", "Data Engineer", "Product Designer") and locations. Set your minimum ATS Match Threshold (e.g., 75%). When Discovery runs, Rolvio scrapes matching postings, evaluates each description against your resume, and only approves jobs that meet your criteria.',
                    'imageUrl': None
                },
                {
                    'id': 'guide-step-7',
                    'heading': '7. Launch Autonomous Stealth Auto-Apply',
                    'content': 'Review your matched jobs in the "Pending Review" queue or head straight to "Mission Control" and click "Start Autonomous Engine". Rolvio will launch its stealth Playwright automation, fill application forms with human-like typing and mouse movements, handle screening questions, verify DOM submission confirmation, and log screenshots of every successful application.',
                    'imageUrl': None
                },
                {
                    'id': 'guide-step-8',
                    'heading': '8. Connect IMAP Email & Track Real-Time Interviews',
                    'content': 'In Settings, enter your IMAP email details (such as your Gmail App Password). Rolvio will silently monitor incoming recruiter responses in the background. As interview invites, coding tests, and status updates arrive, Rolvio categorizes them and moves company cards automatically on your Mission Control Kanban board.',
                    'imageUrl': None
                }
            ]
        }
        print('Updated Rolvio successfully in memory')

with open(catalog_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print('Saved catalog.json successfully!')
