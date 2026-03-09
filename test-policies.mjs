// Apply the DELETE RLS policy directly via Supabase management API
// This uses the pg_advisory_... or runs SQL via the REST API

const SUPABASE_URL = 'https://ippcysvqsxqomodxfjxu.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwcGN5c3Zxc3hxb21vZHhmanh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzg0NzAsImV4cCI6MjA3OTc1NDQ3MH0._Tnyt_lprX0NPM5dAok7EeVe3Otv74umm4QYRU6Jw7I';

// Check what policies currently exist on ticket_photos via pg_policies view
async function checkPolicies() {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/version`,
        {
            method: 'POST',
            headers: {
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        }
    );
    console.log('Version check:', res.status, await res.text());
}

// Try to list policies by running a read on pg_policies
async function listPolicies() {
    const res = await fetch(
        // Supabase exposes pg_policies as a special internal view
        `${SUPABASE_URL}/rest/v1/pg_policies?tablename=eq.ticket_photos&select=policyname,cmd`,
        {
            headers: {
                'apikey': ANON_KEY,
                'Authorization': `Bearer ${ANON_KEY}`
            }
        }
    );
    console.log('Policies status:', res.status);
    const body = await res.text();
    console.log('Policies body:', body);
}

async function main() {
    await checkPolicies();
    await listPolicies();
}

main();
