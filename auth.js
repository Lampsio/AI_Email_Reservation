const { google } = require('googleapis');
require('dotenv').config();

async function main() {
  // Konfiguracja OAuth2
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // Zakresy dostępu
  const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  // Generowanie URL autoryzacyjnego
  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Wymuś zawsze zwrot refresh token
  });

  console.log('1. Otwórz ten URL w przeglądarce:');
  console.log(authUrl);
  console.log('\n2. Zaloguj się i zaakceptuj uprawnienia');
  console.log('3. Wklej kod autoryzacyjny z przekierowania poniżej:');

  // Pobranie kodu autoryzacyjnego
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.question('Kod autoryzacyjny: ', async (code) => {
    try {
      // Wymiana kodu na tokeny
      const { tokens } = await auth.getToken(code);
      
      console.log('\n--- NOWE TOKENY ---');
      console.log('Access Token:', tokens.access_token);
      console.log('Refresh Token:', tokens.refresh_token);
      console.log('Expiry Date:', new Date(tokens.expiry_date));
      
      // Zapisz tokeny do .env
      require('fs').appendFileSync(
        '.env',
        `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
      );
      
      console.log('\nRefresh token został zapisany do .env');
    } catch (error) {
      console.error('Błąd podczas pobierania tokenów:', error.message);
    } finally {
      readline.close();
    }
  });
}

main();