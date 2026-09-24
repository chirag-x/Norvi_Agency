import { createClient } from '@supabase/supabase-js';

const url = 'https://lpzqvziejdpzykwrhkmn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwenF2emllamRwenlrd3Joa21uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDE0NTEwNywiZXhwIjoyMTA1NzIxMTA3fQ.DVhX0dblxvEQRbvxbyaS0_-bR8gCLyAQ_WYUvy1fhLo';
const supabase = createClient(url, key);

const CRON_SECRET = 'local-cron-secret-123'; // User's cron secret from earlier

async function runTests() {
  console.log('--- STARTING AI AUTOMATED TESTS ---');
  
  // 1. Fetch a real product and order
  // We need an order to simulate the webhook
  const { data: users } = await supabase.from('staff_memberships').select('user_id').limit(1);
  const user_id = users?.[0]?.user_id;
  
  if (!user_id) {
    console.log('❌ Failed: Could not find any users to test with.');
    return;
  }

  const { data: prices } = await supabase.from('prices').select('id, product_id, amount_minor, currency').limit(1);
  const price_id = prices[0].id;
  const product_id = prices[0].product_id;
  const amount_minor = prices[0].amount_minor;
  const currency = prices[0].currency;

  const order_id = crypto.randomUUID();
  
  // Insert a mock pending order
  const { error: insertError } = await supabase.from('orders').insert({
    id: order_id,
    user_id: user_id,
    product_id: product_id,
    price_id: price_id,
    amount_minor: amount_minor,
    currency: currency,
    status: 'pending',
    idempotency_key: crypto.randomUUID()
  });
  if (insertError) {
    console.log('❌ Insert failed:', insertError);
    return;
  }
  
  console.log('✅ Created mock pending order');

  // TEST 1: Process Webhook (Phase 3 + 4)
  const { data: webhookData, error: webhookError } = await supabase.rpc('process_payment_webhook', {
    p_order_id: order_id,
    p_payment_id: 'pay_test_123',
    p_encryption_secret: CRON_SECRET
  });
  
  if (webhookError || !webhookData.ok) {
    console.log('❌ process_payment_webhook Failed:', webhookError || webhookData);
  } else {
    console.log('✅ process_payment_webhook Success (Generated encrypted license)');
  }

  const license_id = webhookData.license_id;

  // TEST 2: Reveal License Key (Phase 4 Decryption)
  const { data: revealData, error: revealError } = await supabase.rpc('reveal_license_key', {
    p_license_id: license_id,
    p_encryption_secret: CRON_SECRET
  });

  if (revealError) {
    console.log('❌ reveal_license_key Failed (Decryption error):', revealError);
  } else {
    console.log('✅ reveal_license_key Success! Decrypted key:', revealData);
  }

  // TEST 3: Activate Agent (Phase 4 Lease info)
  // We need the hash of the key to activate
  const cryptoSubtle = globalThis.crypto.subtle;
  const hashBuffer = await cryptoSubtle.digest('SHA-256', new TextEncoder().encode(revealData));
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const { data: activateData, error: activateError } = await supabase.rpc('activate_agent_license', {
    p_key_hash: hashHex,
    p_product_id: product_id,
    p_device_id: 'test_device_123'
  });

  if (activateError || activateData.error) {
    console.log('❌ activate_agent_license Failed:', activateError || activateData);
  } else {
    console.log('✅ activate_agent_license Success! (Returned claims for JWT)');
  }

  console.log('--- AUTOMATED TESTS COMPLETE ---');
}

runTests();
