const { createClient } = require('@supabase/supabase-js');

async function test() {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake-key';

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: devices, error: fetchError } = await supabase.from('devices').select('*').limit(1);
    
    if (fetchError || !devices || devices.length === 0) {
        console.log("No devices found or error:", fetchError);
        return;
    }

    const d = devices[0];
    console.log("Found device:", d);

    const { data, error } = await supabase.from('devices').update({ active: false }).eq('id', d.id).eq('license_id', d.license_id);
    
    console.log("Update Result Data:", data);
    console.log("Update Result Error:", error);
}

test();
