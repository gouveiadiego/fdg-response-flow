import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchTickets() {
    console.log('Fetching tickets with status finalizado...');
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('status', 'finalizado')
        .order('start_datetime', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Fetch error:', error);
    } else {
        console.log('Finalized Tickets (last 5):');
        data.forEach(t => {
            console.log(`[Code: ${t.code}] [ID: ${t.id}]`);
            console.log(`  Agent Compensation Total: ${t.main_agent_compensation_total}`);
            console.log(`  Revenue Total: ${t.revenue_total}`);
            console.log(`  Toll: ${t.toll_cost}, Food: ${t.food_cost}`);
            console.log('---');
        });
    }
}

fetchTickets();
