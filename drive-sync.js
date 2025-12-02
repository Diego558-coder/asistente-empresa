// ================== GOOGLE DRIVE SYNC MODULE ==================
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const TOKEN_PATH = path.join(__dirname, 'drive-token.json');

// Cliente OAuth2
let oauth2Client = null;

function initOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/drive/oauth-callback';

  if (!clientId || !clientSecret) {
    console.warn('⚠️ Google Drive: Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en .env');
    return null;
  }

  oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Cargar token guardado si existe
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      oauth2Client.setCredentials(token);
      console.log('✅ Google Drive: Token cargado desde', TOKEN_PATH);
    } catch (e) {
      console.warn('⚠️ No se pudo cargar token de Drive:', e.message);
    }
  }

  return oauth2Client;
}

function getAuthUrl() {
  if (!oauth2Client) return null;
  const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
  return oauth2Client.generateAuthUrl({ access_type: 'offline', scope: scopes });
}

async function getTokenFromCode(code) {
  if (!oauth2Client) throw new Error('OAuth2 client no inicializado');
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('✅ Token de Google Drive guardado en', TOKEN_PATH);
  return tokens;
}

function isAuthenticated() {
  if (!oauth2Client) return false;
  const creds = oauth2Client.credentials;
  return !!(creds && creds.access_token);
}

// Lista archivos de Drive (Excel, PDF, Word)
async function listDriveFiles(folderId = null) {
  if (!isAuthenticated()) throw new Error('No autenticado con Google Drive');

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const mimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword' // .doc
  ];

  let query = mimeTypes.map(m => `mimeType='${m}'`).join(' or ');
  if (folderId) query = `(${query}) and '${folderId}' in parents`;
  query += " and trashed=false";

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name, mimeType, modifiedTime, size)',
    pageSize: 100
  });

  return res.data.files || [];
}

// Descargar archivo de Drive
async function downloadFile(fileId, destPath) {
  if (!isAuthenticated()) throw new Error('No autenticado con Google Drive');

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const dest = fs.createWriteStream(destPath);

  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  
  return new Promise((resolve, reject) => {
    res.data
      .on('end', () => resolve(destPath))
      .on('error', reject)
      .pipe(dest);
  });
}

// Extraer texto de PDF
async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text || '';
  } catch (e) {
    console.warn('Error extrayendo texto de PDF:', e.message);
    return '';
  }
}

// Extraer texto de Word (.docx)
async function extractTextFromWord(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  } catch (e) {
    console.warn('Error extrayendo texto de Word:', e.message);
    return '';
  }
}

// Sincronizar Drive → datasets locales
async function syncDriveToDatasets(datasetsDir, documentsDir) {
  if (!isAuthenticated()) throw new Error('No autenticado con Google Drive');

  const folderIds = (process.env.GOOGLE_DRIVE_FOLDERS || '').split(',').map(s => s.trim()).filter(Boolean);
  let allFiles = [];

  if (folderIds.length === 0) {
    // Sin carpetas específicas, listar todos los archivos soportados
    allFiles = await listDriveFiles();
  } else {
    // Listar por cada carpeta
    for (const fid of folderIds) {
      const files = await listDriveFiles(fid);
      allFiles = allFiles.concat(files);
    }
  }

  console.log(`📥 Sincronizando ${allFiles.length} archivos de Google Drive...`);

  const results = { excel: 0, pdf: 0, word: 0, errors: 0 };
  const documents = []; // Array de documentos con texto extraído

  for (const file of allFiles) {
    try {
      const ext = path.extname(file.name).toLowerCase();
      const isExcel = ext === '.xlsx' || ext === '.xls' || file.mimeType.includes('spreadsheet');
      const isPDF = ext === '.pdf' || file.mimeType.includes('pdf');
      const isWord = ext === '.docx' || ext === '.doc' || file.mimeType.includes('wordprocessing');

      if (isExcel) {
        const destPath = path.join(datasetsDir, file.name);
        await downloadFile(file.id, destPath);
        console.log(`📊 Excel descargado: ${file.name}`);
        results.excel++;
      } else if (isPDF) {
        const destPath = path.join(documentsDir, file.name);
        await downloadFile(file.id, destPath);
        const text = await extractTextFromPDF(destPath);
        documents.push({ id: file.id, name: file.name, type: 'pdf', text, modifiedTime: file.modifiedTime });
        console.log(`📄 PDF descargado y procesado: ${file.name}`);
        results.pdf++;
      } else if (isWord) {
        const destPath = path.join(documentsDir, file.name);
        await downloadFile(file.id, destPath);
        const text = await extractTextFromWord(destPath);
        documents.push({ id: file.id, name: file.name, type: 'word', text, modifiedTime: file.modifiedTime });
        console.log(`📝 Word descargado y procesado: ${file.name}`);
        results.word++;
      }
    } catch (e) {
      console.error(`Error procesando ${file.name}:`, e.message);
      results.errors++;
    }
  }

  // Guardar índice de documentos para búsqueda
  const indexPath = path.join(documentsDir, 'documents-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(documents, null, 2));
  console.log(`✅ Sincronización completada: ${results.excel} Excel, ${results.pdf} PDF, ${results.word} Word, ${results.errors} errores.`);

  return { results, documents };
}

// Buscar en documentos indexados
function searchDocuments(query, documentsDir) {
  const indexPath = path.join(documentsDir, 'documents-index.json');
  if (!fs.existsSync(indexPath)) return [];

  const documents = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  const lowerQuery = query.toLowerCase();

  return documents
    .filter(doc => doc.text.toLowerCase().includes(lowerQuery))
    .map(doc => ({
      name: doc.name,
      type: doc.type,
      modifiedTime: doc.modifiedTime,
      snippet: extractSnippet(doc.text, lowerQuery)
    }));
}

function extractSnippet(text, query, contextLength = 150) {
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return text.slice(0, contextLength) + '...';
  const start = Math.max(0, idx - contextLength / 2);
  const end = Math.min(text.length, idx + query.length + contextLength / 2);
  return '...' + text.slice(start, end) + '...';
}

module.exports = {
  initOAuth2Client,
  getAuthUrl,
  getTokenFromCode,
  isAuthenticated,
  listDriveFiles,
  downloadFile,
  syncDriveToDatasets,
  searchDocuments
};
