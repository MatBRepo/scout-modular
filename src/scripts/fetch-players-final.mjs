import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Robust env loading from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envFileContent = fs.readFileSync(envPath, 'utf8');

const envVars = {};
envFileContent.split(/\r?\n/).forEach(line => {
  const [key, ...value] = line.trim().split('=');
  if (key && value.length > 0) {
    envVars[key.trim()] = value.join('=').trim();
  }
});

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseAnonKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Błąd: Nie znaleziono NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY w .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('📡 Próba połączenia z:', supabaseUrl);
  console.log('🔍 Pobieranie rekordów z tabeli "players"...');

  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .limit(10);

    if (error) {
      console.error('❌ Błąd Supabase:', error.message);
      if (error.hint) console.log('💡 Podpowiedź:', error.hint);
      if (error.details) console.log('📄 Szczegóły:', error.details);
    } else if (data) {
      if (data.length === 0) {
        console.log('✅ Połączono, ale tabela "players" jest obecnie pusta.');
      } else {
        console.log(`✅ Sukces! Pobrano ${data.length} rekordów:`);
        console.table(data);
      }
    }
  } catch (err) {
    console.error('💥 Nieoczekiwany błąd skryptu:', err.message);
  }
}

main();
