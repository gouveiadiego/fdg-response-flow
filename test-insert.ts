import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuthInsert() {
    // Try to sign in first to avoid RLS error
    // Replace with a known test user if possible, or we just rely on anon trying
    const payload = {
        client_id: "c68a4192-35a2-4a0b-8dbe-0fa6d7e97d15", // mock valid UUID
        vehicle_id: "4472c6cf-4de4-47ef-ad40-38144b62db5f", // mock valid UUID
        plan_id: "1c2f1f3a-cf3d-4c31-9a7c-17e9bbda5932", // mock valid UUID
        service_type: "acompanhamento_logistico",
        main_agent_id: "e50130d2-8de9-441c-b26a-93235b86bfaa", // mock valid UUID
        city: "Limeira",
        state: "SP",
        start_datetime: new Date().toISOString(),
        created_by_user_id: "e50130d2-8de9-441c-b26a-93235b86bfaa",
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

    console.log('Error:', JSON.stringify(error, null, 2));
}

testAuthInsert();
