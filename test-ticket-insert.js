import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    const { data, error } = await supabase
        .from('tickets')
        .insert({
            client_id: 'a9e14a2c-fcdb-48d6-bb21-16bf4974ba4d', // Use a valid client ID if you know one, or null if it allows
            vehicle_id: null,
            plan_id: null,
            service_type: 'alarme',
            main_agent_id: '80e92243-7182-4f7f-8e41-af27918a38ae', // Use a valid agent ID
            city: 'Test City',
            state: 'SP',
            start_datetime: new Date().toISOString(),
            created_by_user_id: '6ca2df45-4235-430b-93f9-ff4fd0eb1988', // Use a valid user ID
            revenue_base_value: 0,
        })
        .select();

    if (error) {
        console.error('Insert error:', error);
    } else {
        console.log('Insert success:', data);
    }
}

testInsert();
