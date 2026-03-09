// Test photo delete via Supabase REST API
const SUPABASE_URL = 'https://ippcysvqsxqomodxfjxu.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwcGN5c3Zxc3hxb21vZHhmanh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzg0NzAsImV4cCI6MjA3OTc1NDQ3MH0._Tnyt_lprX0NPM5dAok7EeVe3Otv74umm4QYRU6Jw7I';

const headers = {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

async function main() {
    // 1. Check RLS policies via pg_policies
    console.log('--- Checking RLS policies for ticket_photos ---');
    const rlsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/check_policies`,
        { method: 'POST', headers, body: JSON.stringify({ table_name: 'ticket_photos' }) }
    );
    console.log('RLS check status:', rlsRes.status);

    // 2. List existing photos to get an ID
    console.log('\n--- Fetching photos ---');
    const photosRes = await fetch(
        `${SUPABASE_URL}/rest/v1/ticket_photos?select=id,ticket_id,file_url,caption&limit=5`,
        { headers }
    );
    console.log('Fetch status:', photosRes.status);
    const photos = await photosRes.json();
    console.log('Photos found:', JSON.stringify(photos, null, 2));

    if (!Array.isArray(photos) || photos.length === 0) {
        console.log('No photos in DB to test delete!');
        return;
    }

    const photo = photos[0];
    console.log('\n--- Attempting DELETE on photo ID:', photo.id, '---');

    const deleteRes = await fetch(
        `${SUPABASE_URL}/rest/v1/ticket_photos?id=eq.${photo.id}`,
        { method: 'DELETE', headers }
    );
    console.log('Delete status:', deleteRes.status);
    const deleteBody = await deleteRes.text();
    console.log('Delete response body:', deleteBody || '(empty - success!)');

    if (deleteRes.ok) {
        console.log('\n✅ DELETE WORKED! RLS policy is correctly applied.');
        // Verify it's gone
        const verifyRes = await fetch(
            `${SUPABASE_URL}/rest/v1/ticket_photos?id=eq.${photo.id}&select=id`,
            { headers }
        );
        const verifyData = await verifyRes.json();
        console.log('Verify (should be empty):', verifyData);
    } else {
        console.log('\n❌ DELETE FAILED! This is likely an RLS issue.');
        console.log('Error:', deleteBody);
    }
}

main();
