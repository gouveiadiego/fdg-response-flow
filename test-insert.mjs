import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
    // 1. Get a random valid ticket
    const { data: tickets } = await supabase.from('tickets').select('id').limit(1);
    if (!tickets || tickets.length === 0) return console.log('No tickets');
    const ticketId = tickets[0].id;

    // 2. Get a random agent
    const { data: agents } = await supabase.from('agents').select('id').limit(1);
    if (!agents || agents.length === 0) return console.log('No agents');
    const agentId = agents[0].id;

    // 3. Try to insert
    console.log(`Inserting for ticket ${ticketId} and agent ${agentId}`);
    const { error } = await supabase.from('ticket_support_agents').insert({
        ticket_id: ticketId,
        agent_id: agentId,
        km_start: null,
        toll_cost: null
    });

    if (error) {
        console.error('INSERT FAILED:', JSON.stringify(error, null, 2));
    } else {
        console.log('INSERT SUCCESSFUL');
    }
}

testInsert();
