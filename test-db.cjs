const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log('Inserting ticket...');
    const { data, error } = await supabase
        .from('tickets')
        .insert({
            client_id: null,
            vehicle_id: null,
            plan_id: null,
            service_type: 'alarme',
            main_agent_id: '80e92243-7182-4f7f-8e41-af27918a38ae',
            city: 'Test City',
            state: 'SP',
            start_datetime: new Date().toISOString(),
            created_by_user_id: '6ca2df45-4235-430b-93f9-ff4fd0eb1988',
            revenue_base_value: 0,
            revenue_included_hours: 0,
            revenue_included_km: 0,
            revenue_extra_hour_rate: 0,
            revenue_extra_km_rate: 0,
            revenue_discount_addition: 0,
            revenue_total: 0,
        })
        .select();

    if (error) {
        console.error('Insert error:', error);
    } else {
        console.log('Success!', data);
    }
}

testInsert();
