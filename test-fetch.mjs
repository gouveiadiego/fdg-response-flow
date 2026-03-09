import fs from 'fs';
import path from 'path';

// Parse .env manually
const env = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const VITE_SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

async function testFetch() {
    const res = await fetch(`${VITE_SUPABASE_URL}/rest/v1/ticket_support_agents?select=*&limit=5`, {
        headers: {
            'apikey': VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`
        }
    });

    if (!res.ok) {
        console.error('Error fetching:', await res.text());
    } else {
        const data = await res.json();
        console.log('Success! Data length:', data.length);
        console.log(data);
    }
}

testFetch();
