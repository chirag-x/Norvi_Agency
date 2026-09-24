import { createClient } from '@supabase/supabase-js';

async function check() {
  const url = 'https://lpzqvziejdpzykwrhkmn.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwenF2emllamRwenlrd3Joa21uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDE0NTEwNywiZXhwIjoyMTA1NzIxMTA3fQ.DVhX0dblxvEQRbvxbyaS0_-bR8gCLyAQ_WYUvy1fhLo';
  const supabase = createClient(url, key);
  
  const { data, error } = await supabase.from('outbox').select('*');
  console.log(data);
}
check();
