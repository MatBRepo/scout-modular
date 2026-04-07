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

const url = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const anonKey = envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const serviceRoleKey = 'gdi05ZCaa-GLWSqytqXOvnMDgrWI85Hbnov8lVRC4O4PN45EThn1yvJv0S4V3erk';

async function testConnection(testName, headers) {
  console.log(`\n🧪 Test: ${testName}`);
  try {
    const response = await fetch(`${url}/rest/v1/players?select=*&limit=1`, {
      headers: headers
    });
    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log(`Odpowiedź: ${text.slice(0, 500)}`);
  } catch (err) {
    console.error(`Błąd: ${err.message}`);
  }
}

async function main() {
  console.log('📡 Diagnoza połączenia z:', url);

  // Wariant 1: Standardowy Anon
  await testConnection('Standardowy Anon (apikey + Bearer)', {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`
  });

  // Wariant 2: Service Role od użytkownika (apikey + Bearer)
  await testConnection('Service Role User (apikey + Bearer)', {
    'apikey': serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`
  });

  // Wariant 3: Tylko apikey (Service Role)
  await testConnection('Tylko apikey (Service Role)', {
    'apikey': serviceRoleKey
  });

  // Wariant 4: Tylko Authorization (Service Role)
  await testConnection('Tylko Authorization (Service Role)', {
    'Authorization': `Bearer ${serviceRoleKey}`
  });
}

main();
