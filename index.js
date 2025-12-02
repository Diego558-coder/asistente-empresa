import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import * as driveManager from "./driveManager.js";

// Suprimir advertencia de punycode
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' && warning.message.includes('punycode')) return;
  console.warn(warning.name, warning.message);
});

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "";

// Helper: fetch compatible con Node < 18
async function httpFetch(url, options) {
  if (typeof fetch !== 'undefined') return fetch(url, options);
  const mod = await import('node-fetch');
  return mod.default(url, options);
}

// Cargar Drive Manager
driveManager.loadCredentials();
driveManager.loadIndexFromDisk();

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Logging middleware para debug
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Endpoint de prueba y redirección al chat
app.get("/", (req, res) => {
  res.redirect('/chat.html');
});

app.get("/chat", (req, res) => {
  res.redirect('/chat.html');
});

// Endpoint principal del chat
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Falta el campo 'message'" });
    }

    // Preparar contexto desde documentos (RAG sencillo)
    const topMatches = driveManager.searchDocuments(message || "").slice(0, 4);
    const allDocs = driveManager.getDocuments();
    const sources = [];

    function summarizeExcel(doc, maxSheets = 1, maxRows = 6) {
      try {
        const sheets = doc.content?.sheets || {};
        const sheetNames = Object.keys(sheets).slice(0, maxSheets);
        const parts = [];
        for (const sn of sheetNames) {
          const rows = sheets[sn] || [];
          const limited = rows.slice(0, maxRows);
          const headers = Object.keys(limited[0] || {});
          const tableLines = [
            `Hoja: ${sn}`,
            headers.join(" | ") || "",
            ...limited.map(r => headers.map(h => String(r[h] ?? "").replace(/\n/g, " ")).join(" | "))
          ].filter(Boolean);
          parts.push(tableLines.join("\n"));
        }
        return parts.join("\n\n");
      } catch {
        return "";
      }
    }

    let tabla = null;
    const contextChunks = topMatches.map(m => {
      const full = allDocs.find(d => d.id === m.id);
      if (!full) return `Documento: ${m.name}\n${m.snippet || ""}`;
      let body = "";
      if (full.content?.type === "excel") {
        // Preparar contexto textual
        body = summarizeExcel(full);
        // Preparar tabla para UI (primeras filas de la primera hoja)
        if (!tabla) {
          try {
            const sheets = full.content?.sheets || {};
            const firstName = Object.keys(sheets)[0];
            if (firstName) {
              const rows = sheets[firstName] || [];
              tabla = rows.slice(0, 8);
            }
          } catch {}
        }
      } else {
        const txt = full.content?.text || "";
        body = txt.slice(0, 1500);
      }
      sources.push({ id: full.id, name: full.name, link: full.webViewLink, type: full.content?.type || "doc" });
      return `Documento: ${full.name}\nTipo: ${full.content?.type || full.mimeType}\nContenido:\n${body}`;
    });

    const ragContext = contextChunks.length
      ? `Contexto recuperado (máx 4 documentos):\n\n${contextChunks.join("\n\n---\n\n")}`
      : "(No se recuperó contexto de documentos)";

    if (!openai && !OLLAMA_MODEL) {
      // Sin clave de OpenAI: devolver las coincidencias locales como "respuesta" básica
      return res.json({
        ok: true,
        answer:
          "No hay OPENAI_API_KEY configurada. Te muestro lo más relevante encontrado en tus documentos:\n\n" +
          (contextChunks[0] || "Sin resultados"),
        sources,
        tabla,
        engine: 'local'
      });
    }

    // Chat con contexto de documentos (OpenAI u Ollama), con fallback seguro
    try {
      let answer = "";
      if (openai) {
        const completion = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            {
              role: "system",
              content:
                "Eres un asistente empresarial en español. Tienes acceso DIRECTO al contenido de documentos que te proporcionan en el contexto. Cuando te dan el contexto de un documento, ÚSALO para responder sin decir que 'no tienes acceso'. Responde de forma breve, práctica y citando el documento por nombre cuando uses sus datos. Solo di que falta información si el contexto no contiene los datos necesarios.",
            },
            { role: "user", content: `${ragContext}\n\nPregunta: ${message}` },
          ],
          temperature: 0.2,
        });
        answer = completion.choices?.[0]?.message?.content || "No tengo respuesta.";
        console.log('🤖 Motor IA: OpenAI');
        return res.json({ ok: true, answer, sources, tabla, engine: 'openai' });
      } else if (OLLAMA_MODEL) {
        // Ollama local
        const payload = {
          model: OLLAMA_MODEL,
          prompt: `Eres un asistente empresarial. A continuación tienes el contenido REAL y COMPLETO de los documentos disponibles. DEBES usar esta información directamente para responder.\n\n${ragContext}\n\nPregunta del usuario: ${message}\n\nInstrucciones:\n- Responde USANDO los datos que tienes arriba\n- Si encuentras información relevante en el contexto, úsala directamente\n- Cita el nombre del documento cuando uses datos de él\n- Si NO encuentras información en el contexto proporcionado, entonces di que no la tienes\n- Responde en español, de forma breve y práctica\n\nRespuesta:`,
          stream: false,
          options: { temperature: 0.2 }
        };
        const resp = await httpFetch(`${OLLAMA_BASE_URL}/api/generate`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
        const j = await resp.json();
        answer = j.response || j.message || "No tengo respuesta.";
        console.log('🦙 Motor IA: Ollama', OLLAMA_MODEL);
        return res.json({ ok: true, answer, sources, tabla, engine: 'ollama' });
      }
      // Por si no entró en ninguna rama
      return res.json({ ok: true, answer: (contextChunks[0] || "Sin resultados"), sources, tabla, engine: 'local' });
    } catch (llmErr) {
      console.error("⚠️ Modelo IA no disponible, fallback local:", llmErr?.message || llmErr);
      const fallback =
        "No pude usar el modelo de IA en este momento. Aquí tienes lo más relevante encontrado en tus documentos:\n\n" +
        (contextChunks[0] || "Sin resultados");
      return res.json({ ok: true, answer: fallback, sources, tabla, engine: 'local' });
    }
  } catch (error) {
    console.error("Error general en /api/chat:", error);
    // Último fallback para nunca romper la UI
    try {
      const answer = "Algo salió mal procesando tu solicitud. Revisa si el servidor está activo y si hay documentos sincronizados.";
      return res.json({ ok: true, answer });
    } catch {
      return res.status(200).json({ ok: true, answer: "Error interno, pero la UI sigue operativa." });
    }
  }
});

// ---- Google Drive Endpoints ----
app.get('/api/drive/auth', (req, res) => {
  try {
    const url = driveManager.getAuthUrl();
    res.redirect(url);
  } catch (e) {
    res.status(500).send('Error generando URL de autorización');
  }
});

app.get('/api/drive/callback', async (req, res) => {
  try {
    const code = req.query.code;
    await driveManager.authorize(code);
    res.send('<html><body><h3>✅ Autenticado correctamente</h3><p>Redirigiendo al chat...</p><script>setTimeout(() => window.location.href="/chat.html", 1500);</script></body></html>');
  } catch (e) {
    res.status(500).send('Error al autorizar: ' + e.message);
  }
});

app.get('/api/drive/status', (req, res) => {
  res.json({ ok: true, authenticated: driveManager.isAuthenticated(), documents: driveManager.getDocuments() });
});

app.get('/api/drive/credentials', (req, res) => {
  try {
    const info = driveManager.getCredentialsInfo();
    res.json({ ok: true, ...info, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  } catch (e) {
    res.json({ ok: false });
  }
});

app.get('/api/drive/sync', async (req, res) => {
  try {
    const { folderId, incremental } = req.query;
    const result = await driveManager.syncDocuments(folderId || null, String(incremental).toLowerCase() === 'true');
    res.json({ ok: true, ...result, documents: driveManager.getDocuments() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/drive/search', (req, res) => {
  try {
    const { q } = req.query;
    const results = driveManager.searchDocuments(q || '');
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/drive/delete', (req, res) => {
  try {
    const { id } = req.query;
    const ok = driveManager.deleteDocument(id);
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/drive/force-reindex', (req, res) => {
  try {
    const r = driveManager.forceReindex();
    res.json({ ok: true, tokenCount: r.tokens, documents: r.documents });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Compartidos conmigo
app.get('/api/drive/shared', async (req, res) => {
  try {
    console.log('📂 Solicitando archivos compartidos...');
    const files = await driveManager.listSharedWithMe();
    console.log(`✅ Encontrados ${files.length} archivos compartidos`);
    res.json({ ok: true, files });
  } catch (e) {
    console.error('❌ Error en /api/drive/shared:', e.message);
    console.error('Stack:', e.stack);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Sync recursivo de una carpeta
app.get('/api/drive/sync-recursive', async (req, res) => {
  try {
    const { folderId } = req.query;
    const result = await driveManager.syncDocumentsRecursive(folderId);
    res.json({ ok: true, ...result, documents: driveManager.getDocuments() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor del asistente escuchando en http://localhost:${port}`);
});
