import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ippcysvqsxqomodxfjxu.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwcGN5c3Zxc3hxb21vZHhmanh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzg0NzAsImV4cCI6MjA3OTc1NDQ3MH0._Tnyt_lprX0NPM5dAok7EeVe3Otv74umm4QYRU6Jw7I";

const supabase = createClient(supabaseUrl, supabaseKey);

async function listRecentTickets() {
  const { data, error } = await supabase
    .from('tickets')
    .select('code, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching tickets:', error);
    return;
  }

  console.log('Recent Tickets:');
  data.forEach(t => console.log(`${t.code} (${t.created_at})`));
}

listRecentTickets();
