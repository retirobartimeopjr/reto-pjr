import { google } from 'googleapis';
import * as dotenv from 'dotenv';
dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_SHEET_ID = process.env.BARTIMEO_SHEET_ID || process.env.GOOGLE_SHEET_ID;

async function checkColor() {
    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        },
        scopes: SCOPES,
    });
    
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client as any });
    
    const response = await sheets.spreadsheets.get({
        spreadsheetId: GOOGLE_SHEET_ID,
        ranges: ['Respuestas de formulario 1!A1:Z100'],
        includeGridData: true
    });
    
    const gridData = response.data.sheets?.[0]?.data?.[0]?.rowData;
    if (gridData) {
        for (let i = 1; i < gridData.length; i++) {
            const rowValues = gridData[i]?.values;
            if (!rowValues) continue;
            
            const rowText = rowValues.map(v => String(v.formattedValue)).join(' ');
            if (rowText.includes('1068665218')) {
                const cellColor = rowValues[0]?.effectiveFormat?.backgroundColorStyle?.rgbColor;
                console.log(`Found Maria Clara at row ${i+1}. Color:`, JSON.stringify(cellColor, null, 2));
            }
        }
    }
}
checkColor().catch(console.error);
