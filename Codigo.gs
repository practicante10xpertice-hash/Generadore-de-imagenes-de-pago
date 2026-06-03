// ════════════════════════════════════════════════════════════
//  GENERADOR ESTADO JUDICIAL — Codigo.gs (REESTRUCTURADO)
//  Una sola hoja, una sola carpeta, todo mezclado con columna Tipo
// ════════════════════════════════════════════════════════════

const SHEET_ID  = '1Mfh7kGF2vReW86UpdsSM0UK_26UZ2VKeoHu6RNR7qVg';
const FOLDER_ID = '1EE2_Vw74O4MeioE_zX0HYjuyU_llN_RR';
const HOJA      = 'PLANTILLAS DE PAGOS';

// ── Sirve la página web ─────────────────────────────────────
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Generador de Infografías de Pago')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── API endpoint para Vercel (fetch desde el exterior) ──────
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  // Cabeceras CORS — permiten llamadas desde cualquier origen (Vercel incluido)
  // Nota: Apps Script no soporta cabeceras CORS en doPost vía scriptlets,
  // pero al usar Content-Type text/plain el navegador no hace preflight.

  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;
    let result    = { ok: false, error: 'Acción desconocida: ' + action };

    switch (action) {
      case 'getLogos':
        result = accionGetLogos();
        break;
      case 'saveLogos':
        result = accionSaveLogos(payload);
        break;
      case 'guardarPlantilla':
        result = guardarPlantilla(payload);
        break;
      case 'eliminarLogoBanco':
        result = eliminarLogoBanco(payload.key);
        break;
      case 'guardarEstado':
        result = guardarEstadoEmpresas(payload);
        break;
      case 'cargarEstado':
        result = cargarEstadoEmpresas();
        break;
    }

    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ ok: false, error: err.message }));
  }

  return output;
}

// ════════════════════════════════════════════════════════════
//  HOJA DE CÁLCULOS
// ════════════════════════════════════════════════════════════

// Crea o devuelve la hoja con encabezados estándar
function obtenerHoja() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let hoja = ss.getSheetByName(HOJA);

  if (!hoja) {
    hoja = ss.insertSheet(HOJA);
    hoja.appendRow(['Tipo', 'Nombre', 'DriveId', 'URL', 'Fecha']);
    hoja.getRange('1:1').setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#ffffff');
    hoja.setColumnWidth(1, 110);
    hoja.setColumnWidth(2, 220);
    hoja.setColumnWidth(3, 280);
    hoja.setColumnWidth(4, 280);
    hoja.setColumnWidth(5, 160);
    hoja.setFrozenRows(1);
    return hoja;
  }

  // Si existe pero tiene formato antiguo, migrarla
  const headerA1 = hoja.getRange(1, 1).getValue();
  if (headerA1 !== 'Tipo') {
    // Insertar columna A "Tipo"
    hoja.insertColumnBefore(1);
    hoja.getRange(1, 1).setValue('Tipo');
    const lastRow = hoja.getLastRow();
    if (lastRow > 1) {
      hoja.getRange(2, 1, lastRow - 1, 1).setValue('PLANTILLA');
    }
    // Insertar columna URL en la posición 4 si no existe
    const headerD = hoja.getRange(1, 4).getValue();
    if (headerD !== 'URL') {
      hoja.insertColumnBefore(4);
      hoja.getRange(1, 4).setValue('URL');
    }
    hoja.getRange('1:1').setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#ffffff');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

// Registra una fila (Tipo: 'PLANTILLA' o 'LOGO BANCO')
function registrarEnHoja(tipo, nombre, driveId, url) {
  try {
    const hoja = obtenerHoja();
    hoja.appendRow([tipo, nombre, driveId, url || '', new Date()]);
    console.log('✅ Registrado: ' + tipo + ' - ' + nombre);
    return true;
  } catch(e) {
    console.log('❌ ERROR registrando: ' + e.message);
    return false;
  }
}

// Elimina una fila por DriveId (para que al borrar logos también se limpie)
function eliminarDeHoja(driveId) {
  try {
    const hoja = obtenerHoja();
    const datos = hoja.getDataRange().getValues();
    for (let i = datos.length - 1; i >= 1; i--) {
      if (String(datos[i][2]) === String(driveId)) {
        hoja.deleteRow(i + 1);
        console.log('✅ Eliminada fila con driveId: ' + driveId);
      }
    }
    return true;
  } catch(e) {
    console.log('❌ ERROR eliminando: ' + e.message);
    return false;
  }
}

// ════════════════════════════════════════════════════════════
//  DRIVE — una sola carpeta para todo
// ════════════════════════════════════════════════════════════

function obtenerCarpeta() {
  try {
    return DriveApp.getFolderById(FOLDER_ID);
  } catch(e) {
    throw new Error('No se pudo abrir carpeta FOLDER_ID. Revisa el ID. ' + e.message);
  }
}

// Sube un archivo y devuelve {fileId, url}
function subirArchivo(base64, mimeType, nombre) {
  const folder = obtenerCarpeta();
  const bytes  = Utilities.base64Decode(base64);
  const blob   = Utilities.newBlob(bytes, mimeType || 'image/png', nombre);
  const file   = folder.createFile(blob);

  // Intentar hacer público (puede fallar por política de Workspace)
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(e) {
    console.log('⚠ No se pudo hacer público: ' + e.message);
  }

  const fileId = file.getId();
  const url    = 'https://lh3.googleusercontent.com/d/' + fileId + '=s0';
  return { fileId: fileId, url: url };
}

// ════════════════════════════════════════════════════════════
//  ACCIONES PÚBLICAS — llamadas desde el frontend
// ════════════════════════════════════════════════════════════

// Guarda una plantilla descargada (PNG generado)
function guardarPlantilla(payload) {
  try {
    const nombre   = (payload.nombre || 'plantilla.png').toString();
    const base64   = payload.base64 || '';
    const mimeType = payload.mimeType || 'image/png';

    if (!base64) throw new Error('Sin imagen para guardar');

    console.log('📥 Guardando plantilla: ' + nombre);
    const subido = subirArchivo(base64, mimeType, nombre);
    registrarEnHoja('PLANTILLA', nombre, subido.fileId, subido.url);

    return { ok: true, driveId: subido.fileId, url: subido.url };
  } catch(e) {
    console.log('❌ Error guardarPlantilla: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// Guarda los logos de bancos personalizados
function accionSaveLogos(payload) {
  try {
    const bancos = payload.bancos || [];
    const props  = PropertiesService.getScriptProperties();

    // Cargar índice anterior
    const rawIdx = props.getProperty('bancosIndex');
    const indice = rawIdx ? JSON.parse(rawIdx) : [];

    const resultado = [];

    for (const banco of bancos) {
      if (banco.logo && banco.logo.startsWith('data:')) {
        // Logo nuevo en base64 → subir a Drive
        const parts    = banco.logo.split(',');
        const mimeType = parts[0].replace('data:','').replace(';base64','');
        const nombre   = 'logo_' + banco.key + '.png';

        // Eliminar archivo y fila anterior si existía
        const existing = indice.find(b => b.key === banco.key);
        if (existing && existing.fileId) {
          try {
            DriveApp.getFileById(existing.fileId).setTrashed(true);
            eliminarDeHoja(existing.fileId);
          } catch(e) {
            console.log('No se pudo borrar logo anterior: ' + e.message);
          }
        }

        console.log('📥 Subiendo logo: ' + banco.nombre);
        const subido = subirArchivo(parts[1], mimeType, nombre);
        registrarEnHoja('LOGO BANCO', banco.nombre, subido.fileId, subido.url);

        resultado.push({
          nombre:  banco.nombre,
          key:     banco.key,
          logo:    subido.url,
          fileId:  subido.fileId
        });
      } else {
        // Logo ya tiene URL de Drive, conservar
        resultado.push(banco);
      }
    }

    // Guardar índice (solo metadatos)
    props.setProperty('bancosIndex', JSON.stringify(resultado));
    return { ok: true, bancos: resultado };

  } catch(e) {
    console.log('❌ Error accionSaveLogos: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// Devuelve los logos guardados
function accionGetLogos() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('bancosIndex');
    return { ok: true, bancos: raw ? JSON.parse(raw) : [] };
  } catch(e) {
    return { ok: false, bancos: [], error: e.message };
  }
}

// Elimina un logo de banco (Drive + Hoja + Properties)
function eliminarLogoBanco(key) {
  try {
    const props  = PropertiesService.getScriptProperties();
    const rawIdx = props.getProperty('bancosIndex');
    const indice = rawIdx ? JSON.parse(rawIdx) : [];

    const banco = indice.find(b => b.key === key);
    if (banco && banco.fileId) {
      try { DriveApp.getFileById(banco.fileId).setTrashed(true); } catch(e) {}
      eliminarDeHoja(banco.fileId);
    }

    const nuevoIndice = indice.filter(b => b.key !== key);
    props.setProperty('bancosIndex', JSON.stringify(nuevoIndice));
    return { ok: true, bancos: nuevoIndice };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  ESTADO GLOBAL DE EMPRESAS — compartido entre TODOS los usuarios
// ════════════════════════════════════════════════════════════

// Guarda los datos de empresas (cuentas bancarias) para que todos los vean
function guardarEstadoEmpresas(payload) {
  try {
    const estado = payload.estado;
    if (!estado) throw new Error('Sin estado para guardar');
    PropertiesService.getScriptProperties()
      .setProperty('estadoEmpresas', JSON.stringify(estado));
    console.log('✅ Estado de empresas guardado');
    return { ok: true };
  } catch(e) {
    console.log('❌ Error guardando estado: ' + e.message);
    return { ok: false, error: e.message };
  }
}

// Carga los datos de empresas guardados
function cargarEstadoEmpresas() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('estadoEmpresas');
    return { ok: true, estado: raw ? JSON.parse(raw) : null };
  } catch(e) {
    return { ok: false, estado: null, error: e.message };
  }
}

// ════════════════════════════════════════════════════════════
//  MIGRACIÓN — corregir URLs viejas a formato nuevo
// ════════════════════════════════════════════════════════════

function migrarUrlsViejas() {
  console.log('▶ Migrando URLs viejas a formato CDN nuevo...');

  const props  = PropertiesService.getScriptProperties();
  const rawIdx = props.getProperty('bancosIndex');
  if (rawIdx) {
    const indice = JSON.parse(rawIdx);
    const indiceMigrado = indice.map(b => {
      if (b.fileId) {
        b.logo = 'https://lh3.googleusercontent.com/d/' + b.fileId + '=s0';
      }
      return b;
    });
    props.setProperty('bancosIndex', JSON.stringify(indiceMigrado));
    console.log('✅ Migrados ' + indiceMigrado.length + ' logos en Properties');
  }

  const hoja  = obtenerHoja();
  const datos = hoja.getDataRange().getValues();
  let cambios = 0;
  for (let i = 1; i < datos.length; i++) {
    const driveId = datos[i][2];
    const urlActual = datos[i][3];
    if (driveId && urlActual && urlActual.indexOf('drive.google.com/uc') !== -1) {
      const nuevaUrl = 'https://lh3.googleusercontent.com/d/' + driveId + '=s0';
      hoja.getRange(i + 1, 4).setValue(nuevaUrl);
      cambios++;
    }
  }
  console.log('✅ Migradas ' + cambios + ' URLs en la hoja');
  console.log('✅ Migración completa — recarga tu página web');
}

// ════════════════════════════════════════════════════════════
//  TESTS — ejecutar manualmente desde el editor
// ════════════════════════════════════════════════════════════

function testCompleto() {
  console.log('▶ Iniciando test...');

  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    console.log('✅ Sheet OK: ' + ss.getName());
  } catch(e) {
    console.log('❌ Sheet ERROR: ' + e.message); return;
  }

  try {
    const folder = obtenerCarpeta();
    console.log('✅ Folder OK: ' + folder.getName());
  } catch(e) {
    console.log('❌ Folder ERROR: ' + e.message); return;
  }

  try {
    const hoja = obtenerHoja();
    console.log('✅ Hoja OK: ' + hoja.getName());
    console.log('   Encabezados: ' + hoja.getRange(1, 1, 1, 5).getValues()[0].join(' | '));
  } catch(e) {
    console.log('❌ Hoja ERROR: ' + e.message); return;
  }

  registrarEnHoja('TEST', 'fila-de-prueba', 'TEST_ID_' + Date.now(), 'https://ejemplo.com/test');

  console.log('✅ Test completado — revisa la hoja de cálculos');
}
