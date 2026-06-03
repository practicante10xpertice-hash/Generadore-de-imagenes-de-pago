# Generador de Infografías de Pago — Deploy en Vercel

## Arquitectura

```
┌─────────────┐    fetch (POST)    ┌──────────────────┐
│  Vercel      │ ─────────────────→ │  Google Apps      │
│  (Frontend)  │ ←───────────────── │  Script (Backend) │
│  index.html  │    JSON response   │  Codigo.gs        │
└─────────────┘                     └──────────────────┘
```

El frontend (index.html) se aloja en Vercel y se comunica con el backend
(Google Apps Script) via `fetch()` → `doPost()`.

## Pasos para configurar

### 1. Actualizar Codigo.gs en Apps Script

Reemplaza tu `Codigo.gs` actual con el archivo `Codigo.gs` incluido aquí.
La diferencia principal es que se agrega la función `doPost()` que actúa
como API endpoint para recibir llamadas desde Vercel.

### 2. Desplegar el Web App en Apps Script

1. Abre tu proyecto en [script.google.com](https://script.google.com)
2. Ve a **Implementar** → **Nueva implementación**
3. Configura:
   - **Tipo**: Aplicación web
   - **Ejecutar como**: Tu cuenta (Yo)
   - **Quién tiene acceso**: **Cualquier persona**
4. Haz clic en **Implementar**
5. **Copia la URL** que te da (algo como `https://script.google.com/macros/s/AKfycb.../exec`)

### 3. Configurar la URL en index.html

Abre `public/index.html` y busca la línea:

```javascript
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/TU_ID_DE_DEPLOY_AQUI/exec';
```

Reemplaza `TU_ID_DE_DEPLOY_AQUI` con el ID de tu deploy real.

### 4. Subir a Vercel

**Opción A — Via CLI:**
```bash
npm i -g vercel
cd vercel-project
vercel
```

**Opción B — Via GitHub:**
1. Sube esta carpeta a un repositorio de GitHub
2. Ve a [vercel.com](https://vercel.com)
3. Importa el repositorio
4. Vercel lo detectará automáticamente como proyecto estático

## Notas importantes

- Cada vez que **cambies** el `Codigo.gs`, debes crear una **nueva implementación**
  en Apps Script y actualizar la URL en el index.html si cambia.
- El `Content-Type` del fetch es `text/plain` en vez de `application/json`
  porque Google Apps Script no parsea bien JSON con content-type json en doPost.
- Si tienes problemas de CORS, verifica que el acceso del Web App sea "Cualquier persona".

## Archivos

- `public/index.html` — Frontend completo (adaptado para Vercel)
- `Codigo.gs` — Backend en Apps Script (con doPost agregado)
- `vercel.json` — Configuración de Vercel
