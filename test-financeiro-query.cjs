const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ippcysvqsxqomodxfjxu.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwcGN5c3Zxc3hxb21vZHhmanh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzg0NzAsImV4cCI6MjA3OTc1NDQ3MH0._Tnyt_lprX0NPM5dAok7EeVe3Otv74umm4QYRU6Jw7I";

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable(tableName) {
    console.log(`Inspecting table: ${tableName}`);
    const { data, error } = await supabase.from(tableName).select('*').limit(1);

    if (error) {
        console.error(`Error inspecting ${tableName}:`, error.message);
    } else if (data && data.length > 0) {
        console.log(`Column names in ${tableName}:`, Object.keys(data[0]).join(', '));
    } else {
        // Try a specific column to see if it works
        const { error: colError } = await supabase.from(tableName).select('id').limit(1);
        if (colError) {
            console.error(`Error selecting ID from ${tableName}:`, colError.message);
        } else {
            console.log(`Table ${tableName} exists but is empty.`);
        }
    }
}

async function run() {
    await inspectTable('agents');
    await inspectTable('tickets');
}

run();
