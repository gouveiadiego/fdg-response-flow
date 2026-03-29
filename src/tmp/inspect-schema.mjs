import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ippcysvqsxqomodxfjxu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwcGN5c3Zxc3hxb21vZHhmanh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzg0NzAsImV4cCI6MjA3OTc1NDQ3MH0._Tnyt_lprX0NPM5dAok7EeVe3Otv74umm4QYRU6Jw7I";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspect() {
    console.log('Fetching one agent...');
    const { data: agents, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .limit(1);

    if (agentError) {
        console.error('Agent fetch error:', agentError);
    } else if (agents.length > 0) {
        console.log('Agent keys:', Object.keys(agents[0]));
        console.log('Agent sample:', agents[0]);
    }

    console.log('\nFetching one client...');
    const { data: clients, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .limit(1);

    if (clientError) {
        console.error('Client fetch error:', clientError);
    } else if (clients.length > 0) {
        console.log('Client keys:', Object.keys(clients[0]));
        console.log('Client sample:', clients[0]);
    }

    console.log('\nFetching one ticket...');
    const { data: tickets, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .limit(1);

    if (ticketError) {
        console.error('Ticket fetch error:', ticketError);
    } else if (tickets.length > 0) {
        console.log('Ticket keys:', Object.keys(tickets[0]));
    }
}

inspect();
