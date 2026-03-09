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

async function checkTable() {
    console.log('Querying ticket_support_agents...');
    const { data, error } = await supabase
        .from('ticket_support_agents')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error querying table:', error);
    } else {
        console.log('Success! Table exists. Data length:', data.length);
        console.log(data);
    }
}

checkTable();
