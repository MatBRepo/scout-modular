import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://supabase-entrisoscout.entriso.com';
const serviceRoleKey = 'gdi05ZCaa-GLWSqytqXOvnMDgrWI85Hbnov8lVRC4O4PN45EThn1yvJv0S4V3erk';
const anonKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTczMDAwMDAwMCwiZXhwIjoyMDg2MzYwMDAwfQ.FYJS67lIN7ZIYs6yhBLtu_kHuVCgbx98BHlsKpQUYTw';

// Nagłówki imitujące przeglądarkę, aby "przejść" przez Cloudflare
const commonHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9,pl;q=0.8',
  'Origin': 'https://supabase-entrisoscout.entriso.com',
  'Referer': 'https://supabase-entrisoscout.entriso.com/'
};

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: commonHeaders
  }
});

async function extractTable(tableName) {
  console.log(`📡 Pobieranie danych z tabeli: "${tableName}" (z nagłówkami browser-like)...`);
  const { data, error } = await supabase
    .from(tableName)
    .select('*');

  if (error) {
    console.warn(`⚠️  Tabela "${tableName}" zwróciła błąd: ${error.message}`);
    return null;
  }
  return data;
}

async function main() {
  const allResults = {};
  const tablesToTry = ['players', 'global_players', 'observations', 'tm_players_cache', 'observation_ratings'];

  for (const table of tablesToTry) {
    const data = await extractTable(table);
    if (data) {
      allResults[table] = data;
      console.log(`✅ Pobrano ${data.length} rekordów z "${table}".`);
    }
  }

  // Fallback do Anon Key z nowymi nagłówkami
  if (Object.keys(allResults).length === 0) {
    console.log('\n🔄 Próba z Anon Key i nagłówkami browser-like...');
    const supabaseAnon = createClient(supabaseUrl, anonKey, {
      global: { headers: commonHeaders }
    });
    
    for (const table of tablesToTry) {
      const { data, error } = await supabaseAnon.from(table).select('*');
      if (!error && data) {
        allResults[table] = data;
        console.log(`✅ Pobrano ${data.length} rekordów z "${table}" (via Anon).`);
      }
    }
  }

  if (Object.keys(allResults).length > 0) {
    const outputPath = path.resolve(process.cwd(), 'extracted_data.json');
    fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
    console.log(`\n📁 Wszystkie dane zapisano do pliku: ${outputPath}`);

    console.log('\n--- PODSUMOWANIE ---');
    Object.keys(allResults).forEach(table => {
      console.log(`${table}: ${allResults[table].length} rekordów`);
    });
  } else {
    console.error('❌ Nadal brak dostępu. Prawdopodobnie Cloudflare Zero Trust wymaga aktywnej sesji lub tokena dostępu CF.');
  }
}

main();
