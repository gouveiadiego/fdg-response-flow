import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function listTickets() {
  const { data, error } = await supabase
    .from('tickets')
    .select('id, code, main_agent_arrival, main_agent_departure, km_start, km_end')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Recent Tickets:');
  console.table(data);
}

listTickets();
