# 🚀 Configuración de Google Drive para el Asistente IA

## 📋 Pasos para conectar Google Drive

### 1. Crear proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Dale un nombre descriptivo (ej: "Asistente Empresa IA")

### 2. Habilitar Google Drive API

1. En el menú lateral, ve a **APIs & Services** → **Library**
2. Busca "Google Drive API"
3. Haz clic en **Enable**

### 3. Crear credenciales OAuth 2.0

1. Ve a **APIs & Services** → **Credentials**
2. Haz clic en **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Si es la primera vez, configura la **OAuth consent screen**:
   - User Type: **Internal** (si es para tu organización) o **External**
   - App name: "Asistente IA Empresa"
   - User support email: tu email
   - Developer contact: tu email
   - Guarda y continúa
   
4. Vuelve a **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID**
5. Application type: **Desktop app**
6. Name: "Asistente Desktop"
7. Haz clic en **Create**

### 4. Descargar credenciales

1. Después de crear, verás un modal con Client ID y Client Secret
2. **COPIA AMBOS VALORES**
3. También puedes descargar el JSON haciendo clic en el ícono de descarga

### 5. Configurar .env

Abre el archivo `.env` en la raíz del proyecto y completa:

```env
# Google Drive API (OAuth2)
GOOGLE_CLIENT_ID=tu_client_id_aqui.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu_client_secret_aqui
GOOGLE_REDIRECT_URI=http://localhost:3001/api/drive/oauth-callback

# Opcional: IDs de carpetas específicas de Drive (separados por comas)
# Déjalo vacío para sincronizar TODOS los archivos soportados
GOOGLE_DRIVE_FOLDERS=
```

**Ejemplo:**
```env
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-1234567890abcdefghij
GOOGLE_REDIRECT_URI=http://localhost:3001/api/drive/oauth-callback
GOOGLE_DRIVE_FOLDERS=1a2b3c4d5e6f7g8h9i0j,9z8y7x6w5v4u3t2s1r0q
```

### 6. Autorizar la aplicación

Una vez configurado el `.env`:

1. **Instala dependencias**:
   ```powershell
   cd "C:\Users\diego\Desktop\Para trabajo\asistente-empresa\asistente-empresa"
   npm install
   ```

2. **Inicia el servidor**:
   ```powershell
   npm start
   ```

3. **Obtén la URL de autorización**:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:3001/api/drive/auth -Method GET | ConvertTo-Json
   ```
   
   Copia la URL que aparece en `authUrl`

4. **Abre la URL en tu navegador**:
   - Inicia sesión con tu cuenta de Google
   - Acepta los permisos (solo lectura de Drive)
   - Serás redirigido a una página de éxito

5. **Verifica autenticación**:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:3001/api/drive/status -Method GET | ConvertTo-Json
   ```
   
   Debe responder: `"authenticated": true`

### 7. Sincronizar archivos

**Primera sincronización**:
```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/drive/sync -Method POST -ContentType 'application/json' | ConvertTo-Json -Depth 5
```

Esto descargará:
- ✅ **Excel (.xlsx, .xls)** → carpeta `datasets/` (para consultas de datos)
- ✅ **PDF (.pdf)** → carpeta `documents/` (extrae texto para búsqueda)
- ✅ **Word (.docx, .doc)** → carpeta `documents/` (extrae texto para búsqueda)

**Ver archivos en Drive**:
```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/drive/list -Method GET | ConvertTo-Json -Depth 5
```

### 8. Usar el asistente

Ahora el asistente puede:

#### Consultar Excel sincronizados
```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/chat -Method POST -ContentType 'application/json' -Body '{"message":"¿Cuántos pagos hay en octubre?"}' | ConvertTo-Json -Depth 5
```

#### Buscar en documentos PDF/Word
```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/chat -Method POST -ContentType 'application/json' -Body '{"message":"¿Qué dice el manual sobre vacaciones?"}' | ConvertTo-Json -Depth 5
```

#### Buscar directamente en documentos
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/documents/search?q=política+de+privacidad" -Method GET | ConvertTo-Json -Depth 5
```

## 🔄 Sincronización periódica

Para mantener los archivos actualizados, ejecuta periódicamente:

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/drive/sync -Method POST -ContentType 'application/json'
```

**Tip**: Puedes crear una tarea programada en Windows o un cron job en Linux para sincronizar automáticamente cada hora/día.

## 🎯 Endpoints disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/drive/auth` | GET | Obtiene URL de autorización OAuth |
| `/api/drive/oauth-callback` | GET | Callback de OAuth (automático) |
| `/api/drive/status` | GET | Verifica si está autenticado |
| `/api/drive/sync` | POST | Sincroniza archivos de Drive |
| `/api/drive/list` | GET | Lista archivos en Drive |
| `/api/documents/search?q=texto` | GET | Busca en documentos sincronizados |
| `/api/chat` | POST | Chat con IA (usa Excel, documentos y chat general) |

## 🔒 Seguridad

- El token de acceso se guarda en `drive-token.json` (añadido a `.gitignore`)
- **NUNCA** subas este archivo a Git
- Las credenciales en `.env` tampoco deben subirse
- El servidor solo tiene permisos de **lectura** en Drive

## 📂 Carpetas específicas

Si solo quieres sincronizar ciertas carpetas de Drive:

1. Abre Drive en el navegador
2. Navega a la carpeta deseada
3. La URL será: `https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j`
4. Copia el ID (la parte después de `/folders/`)
5. Pégalo en `.env`:
   ```env
   GOOGLE_DRIVE_FOLDERS=1a2b3c4d5e6f7g8h9i0j,otro_id_si_hay_más
   ```

## ❓ Solución de problemas

### "Error: No autenticado"
- Ejecuta `/api/drive/auth` y completa el flujo OAuth

### "Error: invalid_client"
- Verifica que `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` estén correctos en `.env`

### "Error: redirect_uri_mismatch"
- En Google Cloud Console → Credentials, agrega `http://localhost:3001/api/drive/oauth-callback` como URI de redirección autorizada

### "No se encontraron archivos"
- Verifica que tu cuenta de Drive tenga archivos Excel/PDF/Word
- Revisa `GOOGLE_DRIVE_FOLDERS` en `.env`

## 🎉 ¡Listo!

Tu asistente ahora puede:
- ✅ Leer Excel de Drive (pagos, asistencia, producción, etc.)
- ✅ Buscar en PDFs y Word (manuales, políticas, documentos)
- ✅ Responder preguntas generales con IA
- ✅ Sincronizar automáticamente con Drive

---

**Próximos pasos sugeridos:**
1. Configurar sincronización automática (tarea programada)
2. Crear un dashboard web para ver documentos sincronizados
3. Añadir soporte para Google Sheets (además de Excel)
4. Implementar caché de embeddings para búsqueda semántica más precisa
