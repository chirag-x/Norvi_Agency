-- Update Omnix
UPDATE public.products
SET tagline = 'Speak your next task into action.',
    description = 'A voice-first desktop agent being developed to understand natural-language instructions, plan tasks, and operate your computer. Capabilities and supported environments will be confirmed through release testing.',
    icon = 'workflow',
    color = 'lime',
    features = ARRAY['Voice-first task instructions', 'Task planning and computer interaction', 'Release scope under development'],
    version = 'In development',
    requirements = 'Supported operating systems and hardware requirements to be confirmed.',
    release_status = 'development'
WHERE slug = 'omnix';

-- Update Voro
UPDATE public.products
SET tagline = 'Bring context to your interview preparation.',
    description = 'An interview assistant with screen and audio context, résumé memory, and coding assistance. Designed for practice and situations where assistance is permitted. The application is reported complete; the NORVI release and compatibility checks are still being prepared.',
    icon = 'message',
    color = 'blue',
    features = ARRAY['Screen and audio context', 'Résumé and conversation memory', 'Local and cloud AI options', 'Coding assistance'],
    version = 'Release version to be confirmed',
    requirements = 'Windows-oriented application. Supported Windows versions, audio setup, and local-model hardware requirements need verification.',
    release_status = 'prelaunch'
WHERE slug = 'voro';

-- Update Rolvio
UPDATE public.products
SET tagline = 'Your next role, with less routine.',
    description = 'Discover relevant openings, compare job descriptions with your résumé, assist with applications, and track responses in a Kanban workspace. The application is reported complete; supported-platform testing and the NORVI release are being prepared. Applications require your authorization and accurate profile information.',
    icon = 'sparkles',
    color = 'purple',
    features = ARRAY['Job discovery and résumé-fit scoring', 'Application workflow and duplicate detection', 'Email response tracking', 'Kanban application dashboard'],
    version = 'Release version to be confirmed',
    requirements = 'Python application with a browser-driven workflow. Packaged installer, supported systems, AI provider setup, and email requirements to be confirmed.',
    release_status = 'prelaunch'
WHERE slug = 'rolvio';
