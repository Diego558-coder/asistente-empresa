# 🚀 Guía Rápida - Asistente Empresarial con Google Drive

## Inicio Rápido

### 1. Arrancar el Servidor
```powershell
cd "C:\Users\diego\Desktop\Para trabajo\asistente-empresa\asistente-empresa"
npm start
```

El servidor estará disponible en: **http://localhost:3001**

### 2. Abrir la Interfaz
- Abre tu navegador y ve a: **http://localhost:3001**
- Se cargará automáticamente el chat con el panel de Drive

## 🔐 Configuración Google Drive (Solo Primera Vez)

### Paso 1: Autenticar
1. En la interfaz web, pulsa el botón **"Autenticar Drive"**
2. Acepta los permisos de Google
3. Serás redirigido automáticamente al chat

### Paso 2: Sincronizar Carpetas Compartidas
1. Pulsa **"Compartidos conmigo"**
2. Verás una lista de carpetas y archivos compartidos
3. Para cada carpeta que quieras sincronizar:
   - Pulsa **"Usar como Folder"** (esto copia el ID automáticamente)
   - Pulsa **"Sync Recursivo"** para bajar todo el contenido (incluye subcarpetas)

### Paso 3: Buscar Documentos
- Escribe palabras clave en el campo de búsqueda
- Pulsa **"Buscar"**
- Los resultados muestran:
  - Nombre del documento
  - Snippet del contenido
  - Botón **"Abrir"** para ver en Drive
  - Botón **"Borrar"** para quitar del índice local

## 📋 Botones y Funciones

| Botón | Función |
|-------|---------|
| **Autenticar Drive** | Inicia el proceso de autorización OAuth2 |
| **Compartidos conmigo** | Lista carpetas/archivos compartidos contigo |
| **Sync Incremental** | Sincroniza solo cambios nuevos de la carpeta indicada |
| **Sync Recursivo** | Descarga toda la carpeta y subcarpetas (usa esto para carpetas completas) |
| **Reindex** | Reconstruye el índice de búsqueda sin descargar de nuevo |
| **Estado** | Muestra si estás autenticado y cuántos documentos tienes indexados |
| **Credenciales** | Info técnica sobre tu configuración OAuth |
| **Buscar** | Busca palabras en el contenido de los documentos |
| **Limpiar** | Borra los resultados de búsqueda de la pantalla |

## 💡 Flujo de Trabajo Típico

### Primera Vez
1. ▶️ Iniciar servidor (`npm start`)
2. 🌐 Abrir http://localhost:3001
3. 🔐 Pulsar "Autenticar Drive" y aceptar
4. 📁 Pulsar "Compartidos conmigo"
5. ✅ "Usar como Folder" en la carpeta deseada
6. 📥 "Sync Recursivo" para descargar todo
7. 🔍 Buscar documentos

### Uso Diario
1. ▶️ `npm start`
2. 🌐 Abrir http://localhost:3001
3. 🔍 Buscar directamente (el índice persiste)
4. 📥 "Sync Incremental" ocasionalmente para actualizar

## 🗂️ Carpetas Importantes del Drive

Según tus capturas, tienes estas carpetas compartidas:
- **Op- PLACA 21850** - Carpeta principal de operaciones
- **2. PLACA 21850 ELMOLINO** - Documentos específicos del proyecto
- Subcarpetas como:
  - COMBUSTIBLE 2025
  - FORMATOS DE CONTROL SCANEADOS
  - MANUAL DE OPERACIÓN SEGURA DE MAQUINARIA PESADA
  - CONTROL MINI-DUMPER
  - CONTROL PRODUCCION.xlsx
  - plan de produccion.xlsx

**Tip:** Sincroniza la carpeta padre "Op- PLACA 21850" con **Sync Recursivo** para obtener todo de una vez.

## 📊 Archivos Excel

Los archivos Excel sincronizados se guardan automáticamente en la carpeta `datasets/` y estarán disponibles para consultas futuras.

## ❓ Preguntas Frecuentes

**P: ¿Cómo sé si estoy autenticado?**  
R: Pulsa "Estado". Debe decir "Autenticado: Sí"

**P: ¿Por qué no veo resultados al buscar?**  
R: Primero debes sincronizar. Pulsa "Sync Recursivo" con una carpeta seleccionada.

**P: ¿Puedo sincronizar varias carpetas?**  
R: Sí, usa "Usar como Folder" + "Sync Recursivo" para cada carpeta. Los documentos se acumulan.

**P: ¿Necesito sincronizar cada vez?**  
R: No. El índice se guarda. Sincroniza solo cuando haya cambios.

**P: ¿Qué pasa si borro un documento con el botón "Borrar"?**  
R: Solo se quita del índice local. El archivo en Drive NO se elimina.

## 🛠️ Solución de Problemas

### No arranca el servidor
```powershell
npm install
npm start
```

### No encuentra módulos
Verifica que estés en la carpeta correcta:
```powershell
cd "C:\Users\diego\Desktop\Para trabajo\asistente-empresa\asistente-empresa"
```

### Error de autenticación
- Verifica que el archivo `credentials.json` esté en `.credentials/`
- Si persiste, borra `.credentials/token.json` y vuelve a autenticar

### La búsqueda no funciona
- Pulsa "Reindex" para reconstruir el índice
- Si no hay documentos, sincroniza primero

## 🎯 Próximos Pasos

1. Sincroniza tus carpetas principales de trabajo
2. Prueba búsquedas con palabras clave de tus documentos
3. Usa el chat para preguntas generales (requiere configurar OPENAI_API_KEY en .env)

---

**¿Necesitas ayuda?** El servidor muestra mensajes útiles en la consola cuando algo falla.
