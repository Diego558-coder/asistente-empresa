# 🤖 Asistente Empresarial con IA

Asistente inteligente que responde preguntas sobre **Excel, PDFs, documentos de Google Drive y consultas generales**, usando IA local (Ollama) para máxima privacidad.

## ✨ Características

- 🗣️ **Chat general estilo ChatGPT**: responde cualquier pregunta ("¿cuánto es 2+2?", "explica la fotosíntesis")
- 📊 **Consultas sobre múltiples Excels**: producción, pagos, asistencia, inventario, lo que sea
- 📁 **Acceso completo a Google Drive**: lee y consulta todos los documentos de la empresa
- 📄 **Parseo inteligente**: Excel, PDF, Word, Google Docs/Sheets
- 🔍 **Búsqueda en documentos**: encuentra información en cualquier archivo
- 🛡️ **100% local**: usa Ollama (llama3.2) sin enviar datos a la nube
- 🌐 **API REST completa**: endpoints para todo
- 💻 **UI web incluida**: chat.html listo para usar

## 🚀 Inicio rápido

### 1. Instalar dependencias

```powershell
cd "C:\Users\diego\Desktop\Para trabajo\asistente-empresa\asistente-empresa"
npm install
```

### 2. Configurar Ollama

```powershell
# Descargar e instalar Ollama desde https://ollama.ai
ollama pull llama3.2
```

### 3. Arrancar servidor

```powershell
npm start
```

El servidor arrancará en <http://localhost:3001>

### 4. Abrir la interfaz web

Abre `asistente-empresa/chat.html` en tu navegador.

## 📋 Configuración de Google Drive (opcional)

Para acceder a documentos de Google Drive, sigue la guía completa: **[DRIVE_SETUP.md](DRIVE_SETUP.md)**

Resumen rápido:

1. Crea un proyecto en Google Cloud Console
2. Habilita Google Drive API
3. Crea credenciales OAuth2
4. Guarda `credentials.json` en `.credentials/`
5. Visita <http://localhost:3001/api/drive/auth>
6. Ejecuta POST `/api/drive/sync` para sincronizar

## 📚 Uso

### Subir Excels locales

```powershell
# Copiar Excels a la carpeta datasets
Copy-Item -Path "C:\ruta\a\tu\pagos.xlsx" -Destination "asistente-empresa\datasets\"

# O subir vía API
# En Postman: POST http://localhost:3001/api/datasets/upload (form-data: file)
```

### Consultar datos

```powershell
# Ver datasets cargados
Invoke-RestMethod -Uri http://localhost:3001/api/datasets | ConvertTo-Json -Depth 5

# Previsualizar hoja de Excel
Invoke-RestMethod -Uri "http://localhost:3001/api/datasets/produccion/Sheet1/preview?rows=20" | ConvertTo-Json -Depth 5

# Chat: producción
Invoke-RestMethod -Uri http://localhost:3001/api/chat -Method POST -ContentType 'application/json' -Body '{"message":"Producción por máquina del 1 al 15 de agosto"}' | ConvertTo-Json

# Chat: general
Invoke-RestMethod -Uri http://localhost:3001/api/chat -Method POST -ContentType 'application/json' -Body '{"message":"¿Qué es la inteligencia artificial?"}' | ConvertTo-Json

# Chat: sobre documentos del Drive
Invoke-RestMethod -Uri http://localhost:3001/api/chat -Method POST -ContentType 'application/json' -Body '{"message":"¿Qué dice el manual sobre vacaciones?"}' | ConvertTo-Json
```

## 🔌 API Endpoints

### Datasets (Excels)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/datasets` | GET | Lista todos los datasets cargados (con hojas y columnas) |
| `/api/datasets/reload` | GET | Reescanea la carpeta datasets |
| `/api/datasets/upload` | POST | Sube un Excel (form-data: file) |
| `/api/datasets/:dataset/:sheet/preview?rows=N` | GET | Vista previa de N filas de una hoja |

### Google Drive

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/drive/auth` | GET | URL de autorización OAuth |
| `/api/drive/oauth-callback` | GET | Callback OAuth (automático) |
| `/api/drive/status` | GET | Estado de autenticación |
| `/api/drive/sync?folderId=ID&incremental=true` | POST | Sincronizar archivos (opcional carpeta y modo incremental) |
| `/api/drive/list` | GET | Listar archivos en Drive |
| `/api/documents/search?q=texto` | GET | Buscar en documentos sincronizados (legacy) |
| `/api/drive/search?q=texto` | GET | Buscar usando índice rápido |
| `/api/drive/credentials` | GET | Información del client_id cargado |
| `/api/drive/delete?id=ID` | DELETE | Elimina documento del índice local |
| `/api/drive/force-reindex` | POST | Reconstruye índice sin volver a descargar |

### Chat y producción (legacy)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/chat` | POST | Chat universal (producción, datasets, documentos, general) |
| `/api/produccion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` | GET | Consulta directa de producción |
| `/api/recargar-excel` | GET | Recarga el Excel de producción (datos/produccion.xlsx) |

### Sistema

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/` | GET | Health check |

## 📁 Estructura del proyecto

```
asistente-empresa/
├── .credentials/              ← Credenciales OAuth (NO subir a Git)
│   ├── credentials.json       ← Client ID/Secret de Google Cloud
│   └── token.json             ← Token generado (automático)
├── datasets/                  ← Excels locales + sincronizados de Drive
│   └── produccion.xlsx
├── datos/                     ← Excel de producción (legacy)
│   └── produccion.xlsx
├── temp/                      ← Archivos temporales (limpieza automática)
├── driveManager.js            ← Módulo de Google Drive
├── index.js                   ← Servidor principal (Express + Ollama)
├── chat.html                  ← Interfaz web del chat
├── package.json               ← Dependencias
├── DRIVE_SETUP.md             ← Guía completa de configuración de Drive
└── README.md                  ← Esta guía
```

## 🛠️ Tecnologías

- **Backend**: Node.js + Express
- **IA**: Ollama (llama3.2) - local, gratis, privado
- **Excel**: xlsx
- **PDF**: pdf-parse
- **Word**: mammoth
- **Google Drive**: googleapis
- **Upload**: multer

## 🔒 Seguridad

- Tokens y credenciales en `.credentials/` (excluido de Git)
- Acceso solo lectura a Drive (`drive.readonly`)
- IA local: ningún dato sale de tu red
- CORS habilitado para desarrollo local

## 🐛 Solución de problemas

### "Cannot GET /api/datasets/reload"
→ El servidor no está arrancado o hay un error de sintaxis. Revisa la consola.

### "Drive no autenticado"
→ Sigue los pasos en [DRIVE_SETUP.md](DRIVE_SETUP.md)

### "Indice vacío tras reinicio"
→ Asegúrate de que existe `.credentials/drive-index.json`; de lo contrario ejecuta `POST /api/drive/force-reindex` o un `/api/drive/sync`.

### "Sync automático no corre"
→ Define variable de entorno `DRIVE_SYNC_INTERVAL_MINUTES` (>0). Ej.:  `set DRIVE_SYNC_INTERVAL_MINUTES=15` antes de `npm start`.

### "No se pudo contactar con Ollama"
→ Verifica que Ollama esté corriendo: `ollama list` y `ollama pull llama3.2`

### "Error al parsear Excel"
→ Verifica que las columnas tengan los nombres esperados (Fecha, Maquina, Cantidad, etc.)

## 📈 Próximos pasos

- [ ] Desplegar en la nube (Railway, Render)
- [ ] Embeber `chat.html` en WordPress
- [ ] Añadir autenticación de usuarios
- [ ] Dashboard con gráficos
- [ ] Sincronización automática periódica de Drive
- [ ] Persistencia de índice en disco
- [ ] Borrado selectivo de documentos

## 📞 Soporte

Para configurar Google Drive, consulta: [DRIVE_SETUP.md](DRIVE_SETUP.md)

---

**¡Listo para responder cualquier pregunta sobre tu empresa!** 🚀
