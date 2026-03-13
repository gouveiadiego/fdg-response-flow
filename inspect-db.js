import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ippcysvqsxqomodxfjxu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwcGN5c3Zxc3hxb21vZHhmanh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzg0NzAsImV4cCI6MjA3OTc1NDQ3MH0._Tnyt_lprX0NPM5dAok7EeVe3Otv74umm4QYRU6Jw7I";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
    console.log('Fetching all agents...');
    const { data: agents, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .limit(10);

    if (agentError) {
        console.error('Agent fetch error:', agentError);
    } else {
        console.log(`Found ${agents.length} agents:`);
        agents.forEach(a => console.log(` - ${a.name} (${a.id})`));
    }

    console.log('\nFetching all tickets (no role join)...');
    const { data: tickets, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .limit(10);

    if (ticketError) {
        console.error('Ticket fetch error:', ticketError);
    } else {
        console.log(`Found ${tickets.length} tickets:`);
        tickets.forEach(t => {
            console.log(`[ID: ${t.id}] [Status: ${t.status}] Code: ${t.code}`);
            console.log(`  Main Agent Compensation Total: ${t.main_agent_compensation_total}`);
            console.log(`  Revenue Total: ${t.revenue_total}`);
        });
    }
}

inspect();
