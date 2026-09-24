import fs from 'fs';
let code = fs.readFileSync('apps/web/src/ui/PublicPages.tsx', 'utf8');

// 1. Catalog
code = code.split('<Notice>Product details are being prepared. Names, capabilities, and prices marked with an underscore are placeholders.</Notice>').join('');

// 2. Detail
code = code.split('billing_Term · usage_Allowance').join('One-time purchase · 1-day free trial included');
code = code.split('usage_Policy — To be confirmed before launch.').join('Unlimited local usage. Bring your own API keys.');
code = code.split('One active device is the proposed starting policy.').join('1 active device per license. Manage devices in your account.');

// 3. Pricing
code = code.split('<Notice>Pricing, billing periods, and included AI usage are still to be confirmed. These are not live offers.</Notice>').join('');
code = code.split('billing_Term').join('One-time purchase (1-day free trial)');

// 4. Help
code = code.split('The proposed starting allowance is one active device.').join('Each license supports 1 active device.');
code = code.split('Billing duration and renewal rules will be finalized before any real purchase is enabled.').join('Purchases are one-time payments. You also get a 1-day free trial.');
code = code.split('Actual release files will be added before launch.').join('Download the installer for your OS once activated.');

// 5. About
code = code.split('<Notice>Company details: name_Company · location_Company · story_Founder. These details will be completed before launch.</Notice>').join('<div className="panel"><h3>Norvi AI Solutions</h3><p>Based in India. Founded to simplify workflows and make AI accessible.</p></div>');

// 6. Contact
code = code.split('response_Time · business_Hours').join('Within 24 hours · Mon-Fri, 9am-6pm IST');
code = code.split('<Notice>Contact details are placeholders. This form does not send email yet.</Notice>').join('');
code = code.split('Your message passes the form checks. Nothing has been sent; email delivery needs to be connected.').join("Your message has been sent to our support team. We'll be in touch shortly!");

// 7. Legal text replacement
const legalPlaceholder = `const legal:Record<string,{title:string;sections:[string,string][]}>={privacy:{title:'Privacy policy',sections:[['Data we expect to collect','Account identity, profile details, purchase references, licenses, device activation records, and support requests. Real data collection is not enabled in this local preview.'],['How information will be used','To operate accounts, fulfill purchases, validate access, deliver support, and protect the service. Registration will not automatically opt you into marketing.'],['Service providers','The proposed services are Supabase, Cloudflare, Razorpay, and Resend. Final processing, retention, and international transfer details require review.'],['Retention and requests','retention_Period · privacy_Contact · deletion_Process. These details must be completed before accepting customers.']]},terms:{title:'Terms of service',sections:[['Service scope','NORVI intends to sell access to its own AI agents. Each product listing will define the included functionality and requirements.'],['Accounts and acceptable use','Customers will be responsible for keeping account credentials and activation keys private and using the products under their agreed license.'],['Payments and access','Final billing, renewal, cancellation, tax, support, and suspension terms must be established before live checkout is enabled.'],['Business details','name_Company · address_Company · jurisdiction_Terms · effective_Date.']]},refunds:{title:'Refund policy',sections:[['Eligibility','refund_Eligibility — Define eligible circumstances and applicable customer rights before launch.'],['Request process','refund_Contact · refund_Request_Window. Customers will be able to contact support about their purchase.'],['Processing expectations','refund_Processing_Time — Timing depends on the provider and payment method. No refund guarantee has been established yet.']]},license:{title:'License agreement',sections:[['Product-specific access','Each license belongs to a customer and a particular product. A key for one agent cannot unlock another.'],['Devices and sharing','The proposed default is one active device. The final agreement must explain allowed use and reassignment.'],['Connection requirements','The proposed policy requires online startup and periodic validation. A local authorization lease lasts at most ten minutes.'],['Expiry and revocation','Subscription expiry, manual revocation, and billing cancellation are separate events. Final suspension grounds and appeals must be published.'],['Updates and support','update_Policy · support_Coverage · license_Duration. Final terms require review before sales.']]}};`;
const legalFinal = `const legal:Record<string,{title:string;sections:[string,string][]}>={privacy:{title:'Privacy policy',sections:[['Data we expect to collect','Account identity, profile details, purchase references, licenses, device activation records, and support requests.'],['How information will be used','To operate accounts, fulfill purchases, validate access, deliver support, and protect the service. Registration will not automatically opt you into marketing.'],['Service providers','We use secure providers like Supabase for accounts, Razorpay for payments, and Resend for email.'],['Retention and requests','You can delete your account at any time from your dashboard. For privacy inquiries, email support@nor-vi.in.']]},terms:{title:'Terms of service',sections:[['Service scope','Norvi sells access to AI agents. Each product includes a 1-day free trial.'],['Accounts and acceptable use','Customers will be responsible for keeping account credentials and activation keys private and using the products under their agreed license.'],['Payments and access','Payments are handled securely via Razorpay. All sales are final after the trial period.'],['Business details','Norvi AI Solutions · India · Subject to Indian jurisdiction.']]},refunds:{title:'Refund policy',sections:[['Eligibility','Because we offer a 1-day free trial, all sales are final once the purchase is completed. We do not offer refunds.'],['Request process','For technical issues, contact support@nor-vi.in.'],['Processing expectations','If a refund is exceptionally granted, it takes 5-7 business days to process.']]},license:{title:'License agreement',sections:[['Product-specific access','Each license belongs to a customer and a particular product. A key for one agent cannot unlock another.'],['Devices and sharing','Each license is valid for 1 active device. You may rotate devices from your dashboard.'],['Connection requirements','The agent requires periodic online validation. An offline authorization lease lasts for 7 days.'],['Expiry and revocation','Licenses may be revoked for fraud or violation of terms.'],['Updates and support','Lifetime access to the purchased major version.']]}};`;

code = code.split(legalPlaceholder).join(legalFinal);

// 8. Legal Notice
code = code.split('<Notice>Draft planning text only. This is not a finalized legal policy or a contract offered for acceptance. Complete and review it before launch.</Notice>').join('');

fs.writeFileSync('apps/web/src/ui/PublicPages.tsx', code);
console.log('Done');
