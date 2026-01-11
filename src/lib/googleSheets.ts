import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export const getAuth = () => {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Service Account credentials are missing');
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
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
  const { GOOGLE_SHEET_ID } = process.env;

  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is missing');
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range,
  });

  return response.data.values || [];
};

export const appendRow = async (range: string, values: any[]) => {
  const sheets = await getSheets();
  const { GOOGLE_SHEET_ID } = process.env;

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
  const { GOOGLE_SHEET_ID } = process.env;

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
