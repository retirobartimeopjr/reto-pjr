import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export const getAuth = () => {
  // In Astro, server-side env vars are available on import.meta.env by default if they are in .env
  // Ensure we are not exposing these to the client (no PUBLIC_ prefix)
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY = import.meta.env.GOOGLE_PRIVATE_KEY;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Service Account credentials are missing. Check .env file.');
  }

  // Handle both literal newlines and escaped newlines directly
  const privateKey = GOOGLE_PRIVATE_KEY.includes('\\n')
    ? GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : GOOGLE_PRIVATE_KEY;

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: SCOPES,
  });
};

export const getSheets = async () => {
  const auth = getAuth();
  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client as any });
};

export const readSheet = async (range: string) => {
  const sheets = await getSheets();
  const GOOGLE_SHEET_ID = import.meta.env.GOOGLE_SHEET_ID;

  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is missing');
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range,
    });

    return response.data.values || [];
  } catch (error) {
    console.error("Error reading sheet:", error);
    throw error;
  }
};

export const appendRow = async (range: string, values: any[]) => {
  const sheets = await getSheets();
  const GOOGLE_SHEET_ID = import.meta.env.GOOGLE_SHEET_ID;

  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is missing');
  }

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: GOOGLE_SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values],
    },
  });

  return response.data;
};

export const updateCell = async (range: string, value: any) => {
  const sheets = await getSheets();
  const GOOGLE_SHEET_ID = import.meta.env.GOOGLE_SHEET_ID;

  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is missing');
  }

  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[value]],
    },
  });

  return response.data;
};
