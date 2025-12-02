# Asistente Empresarial con IA

> Sistema inteligente de análisis de datos empresariales con procesamiento local mediante IA

Sistema de chat que permite consultar y analizar datos de archivos Excel, PDFs y documentos de Google Drive utilizando inteligencia artificial. Implementado con Ollama (LLaMA 3.2) para garantizar privacidad y procesamiento 100% local.

##  Características

- **Consultas en lenguaje natural** sobre datos empresariales
- **Análisis multi-formato**: Excel, PDF, Word, Google Docs/Sheets
- **Integración con Google Drive** para documentos corporativos
- **API REST completa** para integraciones
- **Procesamiento local** sin dependencia de servicios cloud
- **Interfaz web** simple y funcional

## Instalación rápida

### Prerequisitos

- [Node.js](https://nodejs.org/) v16 o superior
- [Ollama](https://ollama.ai) instalado y ejecutándose

### Configuración

```bash
# Clonar repositorio
git clone https://github.com/Diego558-coder/asistente-empresa.git
cd asistente-empresa

# Instalar dependencias
npm install

# Descargar modelo de IA
ollama pull llama3.2

# Iniciar servidor
npm start
```

El servidor estará disponible en `http://localhost:3001`

Abrir `chat.html` en el navegador para usar la interfaz web.

## 📖 Uso

### Cargar documentos

**Excel/PDF/Word**: Coloca los archivos en la carpeta `datos/` o `documents/`

**Google Drive**: Sincroniza tus documentos corporativos

1. Crear proyecto en [Google Cloud Console](https://console.cloud.google.com)
2. Habilitar Google Drive API
3. Obtener credenciales OAuth2
4. Guardar como `.credentials/credentials.json`
5. Visitar `http://localhost:3001/api/drive/auth` para autorizar
6. Ejecutar `POST /api/drive/sync` para sincronizar

Ver [DRIVE_SETUP.md](DRIVE_SETUP.md) para instrucciones detalladas.

### Realizar consultas

Usa la interfaz web `chat.html` o la API:

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cuál fue la producción de agosto?"}'
```

## 🔌 API

### Google Drive

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/drive/auth` | GET | Obtener URL de autorización OAuth |
| `/api/drive/status` | GET | Estado de autenticación |
| `/api/drive/sync` | POST | Sincronizar archivos de Drive |
| `/api/drive/search` | GET | Buscar en documentos sincronizados |
| `/api/drive/list` | GET | Listar archivos disponibles |

### Chat

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/chat` | POST | Enviar consulta al asistente |

## Tecnologías

**Backend**
- Node.js + Express
- Ollama (LLaMA 3.2)

**Procesamiento**
- xlsx (Excel)
- pdf-parse (PDF)
- mammoth (Word)
- Google Drive API

## 📁 Estructura

```
asistente-empresa/
├── index.js              # Servidor principal Express
├── driveManager.js       # Gestión de Google Drive API
├── drive-sync.js         # Sincronización automática
├── chat.html             # Interfaz web del chat
├── .credentials/         # Credenciales OAuth (no versionado)
├── datos/                # Archivos Excel locales
├── documents/            # PDFs y Word locales
├── temp/                 # Archivos temporales
└── package.json          # Dependencias del proyecto
```

## 🔒 Seguridad y privacidad

- Procesamiento 100% local con Ollama
- Credenciales almacenadas localmente (excluidas de Git)
- Acceso de solo lectura a Google Drive
- Sin envío de datos a servicios externos

## 🐛 Solución de problemas

**Ollama no responde**
```bash
ollama list
ollama pull llama3.2
```

**Error de autenticación en Drive**  
Revisar [DRIVE_SETUP.md](DRIVE_SETUP.md) para configuración correcta

**El servidor no inicia**  
Verificar que el puerto 3001 esté disponible

## 📝 Licencia

MIT

---

**Desarrollado por [Diego558-coder](https://github.com/Diego558-coder)**
