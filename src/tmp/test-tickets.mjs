import fs from 'fs';
import path from 'path';

// Parse .env manually
const env = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/"/g, '');
const VITE_SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/"/g, '');

async function testFetch() {
    console.log('Fetching from:', VITE_SUPABASE_URL);
    const res = await fetch(`${VITE_SUPABASE_URL}/rest/v1/tickets?select=id,code,main_agent_arrival,main_agent_departure,km_start,km_end&limit=10&order=created_at.desc`, {
        headers: {
            'apikey': VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`
        }
    });

    if (!res.ok) {
        console.error('Error fetching:', await res.text());
    } else {
        const data = await res.json();
        console.log('Found tickets:', data.length);
        console.table(data);
    }
}

testFetch();
