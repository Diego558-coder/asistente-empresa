const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const datosDir = path.join(__dirname, '..', 'datos');
if (!fs.existsSync(datosDir)) fs.mkdirSync(datosDir, { recursive: true });

const rows = [
  ['Fecha', 'Maquina', 'Linea', 'Turno', 'Cantidad'],
  ['2024-08-01', 'M-01', 'A', 'Día', 350],
  ['2024-08-01', 'M-02', 'B', 'Noche', 280],
  ['2024-08-10', 'M-03', 'A', 'Día', 500],
  ['2024-08-12', 'M-01', 'A', 'Noche', 420]
];

const ws = XLSX.utils.aoa_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

const outPath = path.join(datosDir, 'produccion.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Archivo de ejemplo creado en:', outPath);
