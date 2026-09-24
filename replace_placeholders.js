const fs = require('fs');
let code = fs.readFileSync('apps/web/src/ui/PublicPages.tsx', 'utf8');

// 1. Catalog
code = code.replace(/<Notice>Product details are being prepared[^<]+<\/Notice>/g, '');

// 2. Detail
code = code.replace(/billing_Term · usage_Allowance/g, 'One-time purchase · 1-day free trial included');
code = code.replace(/usage_Policy — To be confirmed before launch\./g, 'Unlimited local usage. Bring your own API keys.');
code = code.replace(/One active device is the proposed starting policy\./g, '1 active device per license. Manage devices in your account.');

// 3. Pricing
code = code.replace(/<Notice>Pricing, billing periods[^<]+<\/Notice>/g, '');
code = code.replace(/billing_Term/g, 'One-time purchase (1-day free trial)');

// 4. Help
code = code.replace(/The proposed starting allowance is one active device\./g, 'Each license supports 1 active device.');
code = code.replace(/Billing duration and renewal rules will be finalized before any real purchase is enabled\./g, 'Purchases are one-time payments. You also get a 1-day free trial.');
code = code.replace(/Actual release files will be added before launch\./g, 'Download the installer for your OS once activated.');

// 5. About
code = code.replace(/<Notice>Company details: name_Company[^<]+<\/Notice>/g, '<div className="panel"><h3>Norvi AI Solutions</h3><p>Based in India. Founded to simplify workflows and make AI accessible.</p></div>');

// 6. Contact
code = code.replace(/response_Time · business_Hours/g, 'Within 24 hours · Mon-Fri, 9am-6pm IST');
code = code.replace(/<Notice>Contact details are placeholders[^<]+<\/Notice>/g, '');
code = code.replace(/Your message passes the form checks[^<]+<\\/Notice>/g, "Your message has been sent to our support team. We'll be in touch shortly!</Notice>");

// 7. Legal text replacement
code = code.replace(
  /const legal:Record<string,\{title:string;sections:\[string,string\]\[\]\}>=\{[\s\S]+?\}\};/g,
  `const legal:Record<string,{title:string;sections:[string,string][]}>={privacy:{title:'Privacy policy',sections:[['Data we expect to collect','Account identity, profile details, purchase references, licenses, device activation records, and support requests.'],['How information will be used','To operate accounts, fulfill purchases, validate access, deliver support, and protect the service. Registration will not automatically opt you into marketing.'],['Service providers','We use secure providers like Supabase for accounts, Razorpay for payments, and Resend for email.'],['Retention and requests','You can delete your account at any time from your dashboard. For privacy inquiries, email support@nor-vi.in.']]},terms:{title:'Terms of service',sections:[['Service scope','Norvi sells access to AI agents. Each product includes a 1-day free trial.'],['Accounts and acceptable use','Customers will be responsible for keeping account credentials and activation keys private and using the products under their agreed license.'],['Payments and access','Payments are handled securely via Razorpay. All sales are final after the trial period.'],['Business details','Norvi AI Solutions · India · Subject to Indian jurisdiction.']]},refunds:{title:'Refund policy',sections:[['Eligibility','Because we offer a 1-day free trial, all sales are final once the purchase is completed. We do not offer refunds.'],['Request process','For technical issues, contact support@nor-vi.in.'],['Processing expectations','If a refund is exceptionally granted, it takes 5-7 business days to process.']]},license:{title:'License agreement',sections:[['Product-specific access','Each license belongs to a customer and a particular product. A key for one agent cannot unlock another.'],['Devices and sharing','Each license is valid for 1 active device. You may rotate devices from your dashboard.'],['Connection requirements','The agent requires periodic online validation. An offline authorization lease lasts for 7 days.'],['Expiry and revocation','Licenses may be revoked for fraud or violation of terms.'],['Updates and support','Lifetime access to the purchased major version.']]}};`
);

// 8. Legal Notice
code = code.replace(/<Notice>Draft planning text only[^<]+<\/Notice>/g, '');

fs.writeFileSync('apps/web/src/ui/PublicPages.tsx', code);
console.log('Done');
