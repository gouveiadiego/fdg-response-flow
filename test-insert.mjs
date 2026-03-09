import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function testInsert() {
    const payload = {
        client_id: "test",
        vehicle_id: "test",
        plan_id: "test",
        service_type: "acompanhamento_logistico",
        main_agent_id: "test",
        city: "Limeira",
        state: "SP",
        start_datetime: new Date().toISOString(),
        created_by_user_id: "e50130d2-8de9-441c-b26a-93235b86bfaa", // using arbitrary valid uuid format, doesn't matter for schema check if RLS is bypassed or using service key. Actually anon key will fail RLS. 
        revenue_base_value: 500,
        revenue_included_hours: 3,
        revenue_included_km: 50,
        revenue_extra_hour_rate: 90,
        revenue_extra_km_rate: 2.50,
        revenue_discount_addition: 0,
        revenue_total: 500,
    };

    const { data, error } = await supabase
        .from('tickets')
        .insert(payload);

    console.log('Error:', error);
    console.log('Data:', data);
}

testInsert();
