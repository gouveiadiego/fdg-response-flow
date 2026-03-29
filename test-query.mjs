import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing join query...');
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      user_id,
      name,
      email,
      user_roles (role)
    `);

  if (error) {
    console.error('Query Error:', error);
  } else {
    console.log('Query Success! Data count:', data?.length);
    console.log('First item:', JSON.stringify(data?.[0], null, 2));
  }
}

test();
