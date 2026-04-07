import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Ręczne wczytanie .env.local bez zależności 'dotenv'
const envPath = path.resolve(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf-8');

const envConfig = {};
envFile.split('\n').forEach(line => {
    const [key, ...value] = line.trim().split('=');
    if (key && value.length > 0) {
        envConfig[key.trim()] = value.join('=').trim();
    }
});

const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fetchPlayers() {
  console.log('--- Rozpoczynam pobieranie danych z tabeli "players" ---');
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .limit(10); // Limitujemy wynik dla przejrzystości czatu

  if (error) {
    console.error('Błąd podczas pobierania:', error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log(`Znaleziono ${data.length} graczy.`);
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('Tabela "players" jest pusta.');
  }
}

fetchPlayers();
