import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://ippcysvqsxqomodxfjxu.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwcGN5c3Zxc3hxb21vZHhmanh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzg0NzAsImV4cCI6MjA3OTc1NDQ3MH0._Tnyt_lprX0NPM5dAok7EeVe3Otv74umm4QYRU6Jw7I";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTicket() {
  const { data, error } = await supabase
    .from('tickets')
    .select('code, detailed_report')
    .eq('code', 'FP-1012')
    .single();

  if (error) {
    console.error('Error fetching ticket:', error);
    return;
  }

  console.log('Ticket FP-1012 Data:');
  console.log('Detailed Report Length:', data.detailed_report ? data.detailed_report.length : 'null');
  if (data.detailed_report) {
    console.log('Last 200 chars:', JSON.stringify(data.detailed_report.slice(-200)));
  }
}

checkTicket();
