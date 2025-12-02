// driveManager.js - Integración con Google Drive (refactor limpio con sync incremental e índice persistente)
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const CREDS_DIR = path.join(__dirname, '.credentials');
const TOKEN_PATH = path.join(CREDS_DIR, 'token.json');
const CREDENTIALS_PATH = path.join(CREDS_DIR, 'credentials.json');
const DRIVE_STATE_PATH = path.join(CREDS_DIR, 'drive-sync-state.json');
const DRIVE_INDEX_PATH = path.join(CREDS_DIR, 'drive-index.json');

let oauth2Client = null;
let driveService = null;
let documentos = []; // { id, name, mimeType, modifiedTime, webViewLink, content }
let driveState = { lastSyncTime: null, files: {} };
let invertedIndex = new Map(); // token -> Set(docId)

function ensureCredentialsDir() {
  if (!fs.existsSync(CREDS_DIR)) fs.mkdirSync(CREDS_DIR, { recursive: true });
}

function loadCredentials() {
  ensureCredentialsDir();
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    // Intentar copiar automáticamente client_secret_*.json
    try {
      const workspaceDir = path.join(__dirname, '..');
      const candidate = fs.readdirSync(workspaceDir).find(f => /^client_secret_.*\.json$/i.test(f));
      if (candidate) {
        const src = path.join(workspaceDir, candidate);
        const raw = JSON.parse(fs.readFileSync(src, 'utf-8'));
        const normalized = raw.installed || raw.web ? raw : { web: raw };
        fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(normalized, null, 2));
        console.log(`🔧 Copiado ${candidate} a .credentials/credentials.json`);
      } else {
        console.warn('⚠️ Falta credentials.json y no se encontró client_secret_*.json');
        return null;
      }
    } catch (e) {
      console.warn('⚠️ Error preparando credentials.json:', e.message);
      return null;
    }
  }
  const content = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  const creds = JSON.parse(content);
  const { client_id, client_secret, redirect_uris } = creds.installed || creds.web;
  oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      oauth2Client.setCredentials(token);
      driveService = google.drive({ version: 'v3', auth: oauth2Client });
      console.log('✅ Autenticado con token existente.');
    } catch (e) {
      console.warn('⚠️ Token inválido, requiere reautenticación.');
    }
  } else {
    console.warn('⚠️ Token no encontrado. Autoriza en /api/drive/auth');
  }
  return oauth2Client;
}

function getAuthUrl() {
  if (!oauth2Client) loadCredentials();
  if (!oauth2Client) throw new Error('Sin credenciales OAuth2.');
  let url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    include_granted_scopes: true,
    prompt: 'consent'
  });
  url = url.replace(/\u0026/g, '&');
  return url;
}

async function authorize(code) {
  if (!oauth2Client) loadCredentials();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  ensureCredentialsDir();
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  driveService = google.drive({ version: 'v3', auth: oauth2Client });
  console.log('✅ Token guardado.');
}

function isAuthenticated() {
  return driveService !== null;
}

async function listFiles(folderId = null, queryOverride = null) {
  if (!driveService) throw new Error('Drive no autenticado.');
  let q = queryOverride || 'trashed=false';
  if (folderId && !queryOverride) q = `'${folderId}' in parents and trashed=false`;
  const res = await driveService.files.list({
    q,
    fields: 'files(id,name,mimeType,modifiedTime,size,webViewLink)',
    pageSize: 200,
    spaces: 'drive',
    corpora: 'allDrives',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });
  return res.data.files || [];
}

async function listSharedWithMe() {
  // sharedWithMe requiere consultar en allDrives cuando hay unidades compartidas
  return await listFiles(null, 'sharedWithMe and trashed=false');
}

async function listChildren(folderId) {
  return await listFiles(null, `'${folderId}' in parents and trashed=false`);
}

async function downloadFile(fileId) {
  const dest = path.join(__dirname, 'temp', `${fileId}.bin`);
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const res = await driveService.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  return new Promise((resolve, reject) => {
    const w = fs.createWriteStream(dest);
    res.data.on('end', () => resolve(dest)).on('error', reject).pipe(w);
  });
}

async function exportGoogleDoc(fileId, mimeType) {
  let exportMime = 'text/plain';
  if (mimeType.includes('spreadsheet')) exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (mimeType.includes('document')) exportMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (mimeType.includes('presentation')) exportMime = 'application/pdf';
  const dest = path.join(__dirname, 'temp', `${fileId}.export`);
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const res = await driveService.files.export({ fileId, mimeType: exportMime }, { responseType: 'stream' });
  return new Promise((resolve, reject) => {
    const w = fs.createWriteStream(dest);
    res.data.on('end', () => resolve(dest)).on('error', reject).pipe(w);
  });
}

async function parseFileContent(filePath, mimeType, name) {
  try {
    if (mimeType.includes('spreadsheet') || /\.xls[x]?$/i.test(name)) {
      const wb = XLSX.readFile(filePath);
      const sheets = {};
      wb.SheetNames.forEach(sn => {
        sheets[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null });
      });
      return { type: 'excel', sheets, text: `Excel ${name} (${wb.SheetNames.length} hojas)` };
    }
    if (mimeType.includes('pdf') || name.toLowerCase().endsWith('.pdf')) {
      const buf = fs.readFileSync(filePath);
      const data = await pdfParse(buf, { max: 0 }).catch(e => ({ text: '', numpages: 0 }));
      return { type: 'pdf', text: data.text || '' };
    }
    if (mimeType.includes('wordprocessingml') || name.toLowerCase().endsWith('.docx')) {
      const result = await mammoth.extractRawText({ path: filePath });
      return { type: 'word', text: result.value };
    }
    if (mimeType.includes('text') || name.toLowerCase().endsWith('.txt')) {
      return { type: 'text', text: fs.readFileSync(filePath, 'utf-8') };
    }
    return { type: 'unknown', text: '' };
  } catch (e) {
    // Solo loguear errores no relacionados con PDFs corruptos
    if (!e.message.includes('Invalid PDF') && !e.message.includes('stream must have data')) {
      console.warn('⚠️ Error parseando', name, e.message);
    }
    return { type: 'error', text: '' };
  }
}

function loadState() {
  if (fs.existsSync(DRIVE_STATE_PATH)) {
    try { driveState = JSON.parse(fs.readFileSync(DRIVE_STATE_PATH, 'utf-8')); } catch (_) {}
  }
}

function saveState() {
  try { fs.writeFileSync(DRIVE_STATE_PATH, JSON.stringify(driveState, null, 2)); } catch (e) { console.warn('⚠️ Error guardando estado:', e.message); }
}

function buildIndex() {
  invertedIndex = new Map();
  const tokenRegex = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/g;
  for (const doc of documentos) {
    const txt = doc.content && doc.content.text;
    if (!txt) continue;
    const tokens = txt.toLowerCase().match(tokenRegex) || [];
    for (const t of tokens) {
      if (!invertedIndex.has(t)) invertedIndex.set(t, new Set());
      invertedIndex.get(t).add(doc.id);
    }
  }
  try {
    const serializable = {};
    invertedIndex.forEach((set, tok) => { serializable[tok] = Array.from(set); });
    fs.writeFileSync(DRIVE_INDEX_PATH, JSON.stringify(serializable));
    console.log(`🔍 Índice construido (${invertedIndex.size} tokens) y guardado.`);
  } catch (e) {
    console.warn('⚠️ No se pudo guardar índice:', e.message);
  }
}

function loadIndexFromDisk() {
  if (fs.existsSync(DRIVE_INDEX_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(DRIVE_INDEX_PATH, 'utf-8'));
      invertedIndex = new Map();
      Object.entries(raw).forEach(([tok, ids]) => invertedIndex.set(tok, new Set(ids)));
      console.log(`🔍 Índice cargado (${invertedIndex.size} tokens).`);
    } catch (e) {
      console.warn('⚠️ Error cargando índice:', e.message);
    }
  }
}

function searchDocuments(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  
  // Normalizar: remover acentos, guiones, símbolos especiales
  const normalize = (s) => s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  
  const qNorm = normalize(q);
  const qTokens = qNorm.split(' ').filter(t => t.length > 2);
  
  // Buscar en índice por cada token
  const matchedIds = new Set();
  qTokens.forEach(tok => {
    const ids = invertedIndex.get(tok);
    if (ids) ids.forEach(id => matchedIds.add(id));
  });
  
  let base = [];
  if (matchedIds.size > 0) {
    base = documentos.filter(d => matchedIds.has(d.id));
  } else {
    // Fallback: búsqueda flexible en nombre y contenido
    base = documentos.filter(d => {
      const nameNorm = normalize(d.name);
      const txt = d.content && d.content.text ? normalize(d.content.text) : '';
      return qTokens.some(tok => nameNorm.includes(tok) || txt.includes(tok));
    });
  }
  
  return base.map(d => {
    let snippet = '';
    const txt = d.content && d.content.text ? d.content.text : '';
    const txtLow = txt.toLowerCase();
    const idx = txtLow.indexOf(q);
    if (idx !== -1) {
      const start = Math.max(0, idx - 80);
      const end = Math.min(txt.length, idx + 160);
      snippet = '...' + txt.slice(start, end) + '...';
    } else {
      snippet = txt.slice(0, 200) + (txt.length > 200 ? '...' : '');
    }
    return { id: d.id, name: d.name, mimeType: d.mimeType, webViewLink: d.webViewLink, snippet };
  });
}

async function syncDocuments(folderId = null, incremental = false) {
  if (!driveService) throw new Error('Drive no autenticado.');
  loadState();
  console.log('🔄 Sync Drive', { folderId, incremental });
  let parts = ['trashed=false'];
  if (folderId) parts.unshift(`'${folderId}' in parents`);
  if (incremental && driveState.lastSyncTime) parts.push(`modifiedTime > '${driveState.lastSyncTime}'`);
  const query = parts.join(' and ');
  const files = await listFiles(null, query);
  let processed = 0;
  for (const f of files) {
    try {
      if (incremental && driveState.files[f.id] && driveState.files[f.id] === f.modifiedTime) continue;
      const isNative = f.mimeType.startsWith('application/vnd.google-apps');
      const tempPath = isNative ? await exportGoogleDoc(f.id, f.mimeType) : await downloadFile(f.id);
      const parsed = await parseFileContent(tempPath, f.mimeType, f.name);
      const idx = documentos.findIndex(d => d.id === f.id);
      const docObj = { id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime, webViewLink: f.webViewLink, content: parsed };
      if (idx >= 0) documentos[idx] = docObj; else documentos.push(docObj);
      driveState.files[f.id] = f.modifiedTime;
      processed++;
      if (parsed.type === 'excel') {
        const datasetsDir = path.join(__dirname, 'datasets');
        if (!fs.existsSync(datasetsDir)) fs.mkdirSync(datasetsDir, { recursive: true });
        fs.copyFileSync(tempPath, path.join(datasetsDir, f.name));
        console.log('📊 Excel sincronizado:', f.name);
      }
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (e) {
      console.warn('⚠️ Error archivo', f.name, e.message);
    }
  }
  driveState.lastSyncTime = new Date().toISOString();
  saveState();
  buildIndex();
  console.log(`✅ Sync completo. Procesados: ${processed}. Total memoria: ${documentos.length}`);
  return { processed, total: documentos.length, incremental };
}

async function syncDocumentsRecursive(folderId) {
  if (!driveService) throw new Error('Drive no autenticado.');
  if (!folderId) throw new Error('Falta folderId');
  loadState();
  let processed = 0;
  async function walk(fid) {
    const children = await listChildren(fid);
    const subfolders = children.filter(c => c.mimeType === 'application/vnd.google-apps.folder');
    const files = children.filter(c => c.mimeType !== 'application/vnd.google-apps.folder');
    for (const f of files) {
      try {
        const isNative = f.mimeType.startsWith('application/vnd.google-apps');
        const tempPath = isNative ? await exportGoogleDoc(f.id, f.mimeType) : await downloadFile(f.id);
        const parsed = await parseFileContent(tempPath, f.mimeType, f.name);
        const idx = documentos.findIndex(d => d.id === f.id);
        const docObj = { id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime, webViewLink: f.webViewLink, content: parsed };
        if (idx >= 0) documentos[idx] = docObj; else documentos.push(docObj);
        driveState.files[f.id] = f.modifiedTime;
        processed++;
        if (parsed.type === 'excel') {
          const datasetsDir = path.join(__dirname, 'datasets');
          if (!fs.existsSync(datasetsDir)) fs.mkdirSync(datasetsDir, { recursive: true });
          fs.copyFileSync(tempPath, path.join(datasetsDir, f.name));
          console.log('📊 Excel sincronizado:', f.name);
        }
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (e) {
        console.warn('⚠️ Error archivo', f.name, e.message);
      }
    }
    for (const sf of subfolders) {
      await walk(sf.id);
    }
  }
  await walk(folderId);
  driveState.lastSyncTime = new Date().toISOString();
  saveState();
  buildIndex();
  console.log(`✅ Sync recursivo completo. Procesados: ${processed}. Total memoria: ${documentos.length}`);
  return { processed, total: documentos.length, recursive: true };
}

function deleteDocument(id) {
  const idx = documentos.findIndex(d => d.id === id);
  if (idx === -1) return false;
  documentos.splice(idx, 1);
  delete driveState.files[id];
  saveState();
  buildIndex();
  return true;
}

function forceReindex() {
  buildIndex();
  return { tokens: invertedIndex.size, documents: documentos.length };
}

function getDocuments() { return documentos; }
function getCredentialsInfo() { return oauth2Client ? { loaded: true, client_id: oauth2Client._clientId || oauth2Client.clientId, redirect_uri: oauth2Client.redirectUri } : { loaded: false }; }

export {
  loadCredentials,
  getAuthUrl,
  authorize,
  isAuthenticated,
  listFiles,
  listSharedWithMe,
  listChildren,
  syncDocuments,
  syncDocumentsRecursive,
  searchDocuments,
  getDocuments,
  getCredentialsInfo,
  loadIndexFromDisk,
  forceReindex,
  deleteDocument,
};
