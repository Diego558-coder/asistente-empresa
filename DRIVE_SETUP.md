# Configuración de Google Drive para el Asistente

Este asistente ahora puede acceder a **todos los documentos de tu empresa en Google Drive** (Excel, PDFs, Word, Google Docs/Sheets) y responder preguntas sobre ellos.

## 🔧 Pasos de configuración

### 1. Crear proyecto en Google Cloud Console

1. Ve a https://console.cloud.google.com/
2. Crea un nuevo proyecto (ej: "Asistente Empresa")
3. Habilita **Google Drive API**:
   - Menú → APIs & Services → Enable APIs and Services
   - Busca "Google Drive API" → Enable

### 2. Configurar OAuth2

1. Ve a **APIs & Services → Credentials**
2. Click en **Create Credentials → OAuth client ID**
3. Si pide configurar OAuth consent screen:
   - User Type: Internal (si tienes Google Workspace) o External
   - App name: "Asistente Empresa"
   - User support email: tu email
   - Scopes: no hace falta agregar nada aquí
   - Test users: agrega tu email
4. Vuelve a **Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: "Asistente Backend"
   - Authorized redirect URIs: `http://localhost:3001/api/drive/oauth-callback`
   - Click **Create**
5. Descarga el JSON de credenciales (botón de descarga en la lista de clients)

### 3. Guardar credenciales en el proyecto

1. Crea la carpeta `.credentials` en `asistente-empresa/`:
   ```powershell
   New-Item -ItemType Directory -Path "C:\Users\diego\Desktop\Para trabajo\asistente-empresa\asistente-empresa\.credentials" -Force
   ```

2. Copia el JSON descargado y guárdalo como:
   ```
   asistente-empresa/.credentials/credentials.json
   ```

   El archivo debe verse así:
   ```json
   {
     "installed": {
       "client_id": "TU_CLIENT_ID.apps.googleusercontent.com",
       "project_id": "tu-proyecto",
       "auth_uri": "https://accounts.google.com/o/oauth2/auth",
       "token_uri": "https://oauth2.googleapis.com/token",
       "client_secret": "TU_CLIENT_SECRET",
       "redirect_uris": ["http://localhost:3001/api/drive/oauth-callback"]
     }
   }
   ```

### 4. Autorizar el asistente

1. Arranca el servidor:
   ```powershell
   cd "C:\Users\diego\Desktop\Para trabajo\asistente-empresa\asistente-empresa"
   npm start
   ```

2. Ve a: http://localhost:3001/api/drive/auth

3. Copia la URL que te da el servidor y ábrela en tu navegador

4. Inicia sesión con tu cuenta de Google (la que tiene acceso al Drive de la empresa)

5. Acepta los permisos (solo lectura de Drive)

6. Verás un mensaje: **✅ Autenticación exitosa con Google Drive**

7. El token se guardará automáticamente en `.credentials/token.json`

## 🚀 Uso

### Sincronizar archivos del Drive

```powershell
# POST para sincronizar todos los archivos
Invoke-RestMethod -Uri http://localhost:3001/api/drive/sync -Method POST | ConvertTo-Json -Depth 5
```

Esto:
- Descarga todos los archivos de tu Drive
- Los Excels se cargan automáticamente en `/api/datasets`
- Los PDFs/Word se indexan para búsqueda de texto
- Los Google Docs/Sheets se exportan y procesan

### Listar archivos disponibles

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/drive/list -Method GET | ConvertTo-Json -Depth 5
```

### Buscar en documentos

```powershell
# Buscar "pagos" en todos los PDFs/Word sincronizados
Invoke-RestMethod -Uri "http://localhost:3001/api/documents/search?q=pagos" -Method GET | ConvertTo-Json -Depth 5
```

### Preguntar en el chat

El asistente ahora busca automáticamente en documentos:

```powershell
# Pregunta sobre cualquier documento del Drive
Invoke-RestMethod -Uri http://localhost:3001/api/chat -Method POST -ContentType 'application/json' -Body '{"message":"¿Qué dice el manual de procedimientos sobre vacaciones?"}' | ConvertTo-Json -Depth 5

# Consultar Excel sincronizado desde Drive
Invoke-RestMethod -Uri http://localhost:3001/api/chat -Method POST -ContentType 'application/json' -Body '{"message":"Total de pagos en el mes de octubre"}' | ConvertTo-Json -Depth 5
```

## 🔄 Sincronización automática (opcional)

Para sincronizar automáticamente cada X horas, agrega en `index.js` al final (antes del `server.listen`):

```javascript
// Sincronizar cada 6 horas
setInterval(async () => {
  if (driveManager.isAuthenticated()) {
    console.log('🔄 Sincronización automática iniciada...');
    try {
      await driveManager.syncDocuments();
      scanDatasets();
      console.log('✅ Sincronización automática completada');
    } catch (e) {
      console.error('❌ Error en sincronización automática:', e.message);
    }
  }
}, 6 * 60 * 60 * 1000); // 6 horas
```

## 📁 Estructura de archivos

```
asistente-empresa/
├── .credentials/
│   ├── credentials.json    ← Credenciales OAuth de Google Cloud
│   └── token.json          ← Token generado (NO compartir)
├── datasets/               ← Excels (locales + sincronizados de Drive)
├── temp/                   ← Archivos temporales durante descarga
├── driveManager.js         ← Módulo de Google Drive
├── index.js                ← Servidor principal
└── DRIVE_SETUP.md          ← Esta guía
```

## ⚠️ Seguridad

- **NO subas `.credentials/` a Git**. Añade en `.gitignore`:
  ```
  .credentials/
  temp/
  ```
- El token de acceso permite **solo lectura** de Drive (scope: `drive.readonly`)
- Puedes revocar acceso en: https://myaccount.google.com/permissions

## 🐛 Solución de problemas

### "No hay credenciales de OAuth2"
→ Falta `credentials.json` en `.credentials/`

### "Drive no autenticado"
→ Visita `/api/drive/auth` y completa el flujo OAuth

### "Token expirado"
→ Borra `token.json` y vuelve a autorizar en `/api/drive/auth`

### "No se pueden descargar archivos"
→ Verifica que tu cuenta tenga permisos de lectura en los archivos del Drive

## 📞 Endpoints disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/drive/auth` | GET | URL de autorización OAuth |
| `/api/drive/oauth-callback` | GET | Callback OAuth (redirige automático) |
| `/api/drive/status` | GET | Estado de autenticación |
| `/api/drive/sync` | POST | Sincronizar archivos de Drive |
| `/api/drive/list` | GET | Listar archivos en Drive |
| `/api/documents/search?q=texto` | GET | Buscar en documentos |
| `/api/datasets` | GET | Ver Excels cargados |
| `/api/chat` | POST | Chat con acceso a Drive |

## ✅ Ya está todo listo

Una vez completada la autorización, el asistente podrá:
- ✅ Leer todos los Excel del Drive y consultarlos
- ✅ Buscar información en PDFs y documentos Word
- ✅ Responder preguntas sobre Google Docs/Sheets
- ✅ Combinar datos de múltiples fuentes (Drive + archivos locales)

**¡Disfruta de tu asistente empresarial con acceso completo a Google Drive!** 🚀
