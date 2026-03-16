import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ippcysvqsxqomodxfjxu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwcGN5c3Zxc3hxb21vZHhmanh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzg0NzAsImV4cCI6MjA3OTc1NDQ3MH0._Tnyt_lprX0NPM5dAok7EeVe3Otv74umm4QYRU6Jw7I";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect(code) {
    console.log(`Searching for ticket ${code}...`);
    const { data: ticket, error } = await supabase
        .from('tickets')
        .select('*, plans(name)')
        .eq('code', code)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Ticket found:', ticket.id);
    console.log('Plan:', ticket.plans?.name);
    console.log('Main Agent Base:', ticket.main_agent_compensation_base_value);

    console.log('\nSupport Agents:');
    const { data: supportAgents, error: supportError } = await supabase
        .from('ticket_support_agents')
        .select('*, agents(name)')
        .eq('ticket_id', ticket.id);

    if (supportError) {
        console.error('Support agents error:', supportError);
        return;
    }

    supportAgents.forEach(sa => {
        console.log(` - Agent: ${sa.agents?.name} (${sa.agent_id})`);
        console.log(`   Base: ${sa.compensation_base_value}`);
        console.log(`   Inc Hour: ${sa.compensation_included_hours}`);
        console.log(`   Inc KM: ${sa.compensation_included_km}`);
    });
}

inspect('FP-1006');
