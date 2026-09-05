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

export const paintRowGreen = async (rowIndex: number) => {
  const sheets = await getSheets();
  const GOOGLE_SHEET_ID = import.meta.env.BARTIMEO_SHEET_ID || import.meta.env.GOOGLE_SHEET_ID;
  
  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is missing');
  }

  // Obtenemos el sheetId real (no el spreadsheetId) para usar en batchUpdate
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
  let sheetName = import.meta.env.BARTIMEO_SHEET_NAME || 'Respuestas de formulario 1';
  const sheetsList = metadata.data.sheets || [];
  
  let foundSheet = sheetsList.find(s => s.properties?.title === sheetName);
  if (!foundSheet) {
      foundSheet = sheetsList.find(s => s.properties?.title?.toLowerCase().startsWith('respuestas de formulario'));
      if (!foundSheet) foundSheet = sheetsList[0];
  }

  if (!foundSheet || foundSheet.properties?.sheetId === undefined) {
      throw new Error("No se pudo encontrar el sheetId");
  }

  const sheetId = foundSheet.properties.sheetId;

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: rowIndex - 1,
              endRowIndex: rowIndex,
            },
            cell: {
              userEnteredFormat: {
                backgroundColorStyle: {
                  rgbColor: {
                    red: 0.85,
                    green: 0.95,
                    blue: 0.85
                  }
                }
              }
            },
            fields: 'userEnteredFormat.backgroundColorStyle'
          }
        }
      ]
    }
  });

  return response.data;
};

export const paintRowGreenByDocument = async (document: string, name?: string) => {
  const sheets = await getSheets();
  const GOOGLE_SHEET_ID = import.meta.env.BARTIMEO_SHEET_ID || import.meta.env.GOOGLE_SHEET_ID;
  
  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is missing');
  }

  // Obtenemos el sheetId real (no el spreadsheetId) para usar en batchUpdate
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
  let sheetName = import.meta.env.BARTIMEO_SHEET_NAME || 'Respuestas de formulario 1';
  const sheetsList = metadata.data.sheets || [];
  
  let foundSheet = sheetsList.find(s => s.properties?.title === sheetName);
  if (!foundSheet) {
      foundSheet = sheetsList.find(s => s.properties?.title?.toLowerCase().startsWith('respuestas de formulario'));
      if (!foundSheet) foundSheet = sheetsList[0];
  }

  if (!foundSheet || foundSheet.properties?.sheetId === undefined || !foundSheet.properties.title) {
      throw new Error("No se pudo encontrar el sheetId");
  }

  const sheetId = foundSheet.properties.sheetId;
  const actualSheetName = foundSheet.properties.title;

  // Leer todos los datos para buscar el documento
  const responseData = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `'${actualSheetName}'`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const rows = responseData.data.values || [];
  if (rows.length < 2) return null; // No hay datos

  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  
  // Buscar índices de columnas
  let docIndex = -1;
  let nameIndex = -1;

  headers.forEach((h, i) => {
      // Mismas reglas de matching que en bartimeoSync.ts
      if (h.includes('documento') || h.includes('cédula') || h.includes('identidad') || h.includes('ti') || h.includes('cc')) {
          if (docIndex === -1) docIndex = i;
      }
      if (h.includes('nombre') || h.includes('nombres')) {
          if (nameIndex === -1) nameIndex = i;
      }
  });

  if (docIndex === -1) {
    throw new Error("No se encontró la columna de documento de identidad en el Excel");
  }

  // Buscar la fila
  let rowIndex = -1;
  const normalizeText = (text: any) => String(text || '').replace(/\D/g, '');

  for (let i = 1; i < rows.length; i++) {
      const rowDoc = normalizeText(rows[i][docIndex]);
      const targetDoc = normalizeText(document);
      
      if (rowDoc === targetDoc && rowDoc !== '') {
          rowIndex = i + 1; // +1 porque el array empieza en 0, y +1 porque las filas de sheets empiezan en 1
          break;
      }
  }

  if (rowIndex === -1) {
      console.warn("No se encontró el documento en Google Sheets para pintar la fila");
      return null;
  }

  // Pintar la fila encontrada
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: rowIndex - 1,
              endRowIndex: rowIndex,
            },
            cell: {
              userEnteredFormat: {
                backgroundColorStyle: {
                  rgbColor: {
                    red: 0.0,
                    green: 1.0,
                    blue: 0.0
                  }
                }
              }
            },
            fields: 'userEnteredFormat.backgroundColorStyle'
          }
        }
      ]
    }
  });

  return response.data;
};

export const paintRowRedByDocument = async (document: string) => {
  const sheets = await getSheets();
  const GOOGLE_SHEET_ID = import.meta.env.BARTIMEO_SHEET_ID || import.meta.env.GOOGLE_SHEET_ID;
  
  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is missing');
  }

  // Obtenemos el sheetId real (no el spreadsheetId) para usar en batchUpdate
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
  let sheetName = import.meta.env.BARTIMEO_SHEET_NAME || 'Respuestas de formulario 1';
  const sheetsList = metadata.data.sheets || [];
  
  let foundSheet = sheetsList.find(s => s.properties?.title === sheetName);
  if (!foundSheet) {
      foundSheet = sheetsList.find(s => s.properties?.title?.toLowerCase().startsWith('respuestas de formulario'));
      if (!foundSheet) foundSheet = sheetsList[0];
  }

  if (!foundSheet || foundSheet.properties?.sheetId === undefined || !foundSheet.properties.title) {
      throw new Error("No se pudo encontrar el sheetId");
  }

  const sheetId = foundSheet.properties.sheetId;
  const actualSheetName = foundSheet.properties.title;

  // Leer todos los datos para buscar el documento
  const responseData = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `'${actualSheetName}'`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const rows = responseData.data.values || [];
  if (rows.length < 2) return null; // No hay datos

  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  
  // Buscar índices de columnas
  let docIndex = -1;

  headers.forEach((h, i) => {
      if (h.includes('documento') || h.includes('cédula') || h.includes('identidad') || h.includes('ti') || h.includes('cc')) {
          if (docIndex === -1) docIndex = i;
      }
  });

  if (docIndex === -1) {
    throw new Error("No se encontró la columna de documento de identidad en el Excel");
  }

  // Buscar la fila
  let rowIndex = -1;
  const normalizeText = (text: any) => String(text || '').replace(/\D/g, '');

  for (let i = 1; i < rows.length; i++) {
      const rowDoc = normalizeText(rows[i][docIndex]);
      const targetDoc = normalizeText(document);
      
      if (rowDoc === targetDoc && rowDoc !== '') {
          rowIndex = i + 1;
          break;
      }
  }

  if (rowIndex === -1) {
      console.warn("No se encontró el documento en Google Sheets para pintar la fila de rojo");
      return null;
  }

  // Pintar la fila encontrada
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: rowIndex - 1,
              endRowIndex: rowIndex,
            },
            cell: {
              userEnteredFormat: {
                backgroundColorStyle: {
                  rgbColor: {
                    red: 1.0,
                    green: 0.0,
                    blue: 0.0
                  }
                }
              }
            },
            fields: 'userEnteredFormat.backgroundColorStyle'
          }
        }
      ]
    }
  });

  return response.data;
};

export const paintRowsGreen = async (rowIndices: number[]) => {
  if (!rowIndices || rowIndices.length === 0) return null;

  const sheets = await getSheets();
  const GOOGLE_SHEET_ID = import.meta.env.BARTIMEO_SHEET_ID || import.meta.env.GOOGLE_SHEET_ID;
  
  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is missing');
  }

  const metadata = await sheets.spreadsheets.get({ spreadsheetId: GOOGLE_SHEET_ID });
  let sheetName = import.meta.env.BARTIMEO_SHEET_NAME || 'Respuestas de formulario 1';
  const sheetsList = metadata.data.sheets || [];
  
  let foundSheet = sheetsList.find(s => s.properties?.title === sheetName);
  if (!foundSheet) {
      foundSheet = sheetsList.find(s => s.properties?.title?.toLowerCase().startsWith('respuestas de formulario'));
      if (!foundSheet) foundSheet = sheetsList[0];
  }

  if (!foundSheet || foundSheet.properties?.sheetId === undefined) {
      throw new Error("No se pudo encontrar el sheetId");
  }

  const sheetId = foundSheet.properties.sheetId;

  const requests = rowIndices.map(rowIndex => ({
    repeatCell: {
      range: {
        sheetId: sheetId,
        startRowIndex: rowIndex - 1,
        endRowIndex: rowIndex,
      },
      cell: {
        userEnteredFormat: {
          backgroundColorStyle: {
            rgbColor: {
              red: 0.0,
              green: 1.0,
              blue: 0.0
            }
          }
        }
      },
      fields: 'userEnteredFormat.backgroundColorStyle'
    }
  }));

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: GOOGLE_SHEET_ID,
    requestBody: {
      requests: requests
    }
  });

  return response.data;
};

export const getSheetColors = async (sheetName: string) => {
  const sheets = await getSheets();
  const GOOGLE_SHEET_ID = import.meta.env.BARTIMEO_SHEET_ID || import.meta.env.GOOGLE_SHEET_ID;
  
  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is missing');
  }

  const response = await sheets.spreadsheets.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    ranges: [`'${sheetName}'!A:A`],
    includeGridData: true
  });

  const rowData = response.data.sheets?.[0]?.data?.[0]?.rowData || [];
  
  const colors: Record<number, string> = {}; // key: sheet_row (1-indexed), value: hex color
  
  const rgbToHex = (r = 0, g = 0, b = 0) => {
      const toHex = (n: number) => {
          const hex = Math.round(n * 255).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
      };
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  rowData.forEach((row, index) => {
    const cell = row.values?.[0];
    const color = cell?.effectiveFormat?.backgroundColorStyle?.rgbColor;
    if (color) {
        // Solo guardar si no es blanco puro (1, 1, 1) ni nulo
        if (color.red !== 1 || color.green !== 1 || color.blue !== 1) {
            colors[index + 1] = rgbToHex(color.red, color.green, color.blue);
        }
    }
  });

  return colors;
};
