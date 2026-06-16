# Buscador de Propiedades · Jonatan

Sistema de búsqueda de oportunidades inmobiliarias en Costa del Sol. Filtra propiedades de Idealista por zona, tipo y precio, y calcula automáticamente cuánto está cada propiedad por debajo del precio medio de zona.

---

## Instalación local

### 1. Clona el repositorio

```bash
git clone <tu-repo>
cd jonatan-property-search
```

### 2. Instala dependencias del backend

```bash
cd backend
npm install
```

### 3. Configura el token de Apify

Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

Abre `.env` y reemplaza el valor:

```
APIFY_TOKEN=apify_api_TU_TOKEN_AQUI
```

**Dónde conseguir el token:**
1. Entra en [apify.com](https://apify.com) y crea una cuenta gratuita
2. Ve a **Settings → Integrations → API tokens**
3. Copia el token y pégalo en `.env`

### 4. Arranca el servidor

```bash
node index.js
```

Verás: `Servidor corriendo en puerto 3000`

### 5. Abre el frontend

Abre `frontend/index.html` directamente en el navegador (doble clic o arrástralo a Chrome).

> El frontend ya apunta a `http://localhost:3000`. Si el backend no responde, muestra datos de ejemplo para que puedas ver la interfaz.

---

## Despliegue en Render.com (producción)

### Requisitos
- Cuenta en [render.com](https://render.com) (gratuita, sin tarjeta)
- Repositorio en GitHub (público o privado)

### Pasos

1. **Sube el código a GitHub**
   ```bash
   git init
   git add .
   git commit -m "MVP inicial"
   git remote add origin https://github.com/tu-usuario/jonatan-search.git
   git push -u origin main
   ```

2. **Crea el servicio en Render**
   - Entra en [dashboard.render.com](https://dashboard.render.com)
   - Haz clic en **New → Web Service**
   - Conecta tu cuenta de GitHub y selecciona el repositorio
   - Configura:
     - **Root Directory:** `backend`
     - **Build Command:** `npm install`
     - **Start Command:** `node index.js`
     - **Instance Type:** Free

3. **Añade la variable de entorno**
   - En la sección **Environment** añade:
     - Key: `APIFY_TOKEN`
     - Value: tu token de Apify

4. **Despliega**
   - Haz clic en **Create Web Service**
   - Render desplegará automáticamente. En 2-3 minutos tendrás una URL tipo:
     `https://jonatan-search.onrender.com`

5. **Actualiza el frontend con la URL de producción**

   Abre `frontend/index.html` y busca esta línea (aprox. línea 200):
   ```javascript
   const BACKEND_URL = 'http://localhost:3000';
   ```
   Cámbiala por:
   ```javascript
   const BACKEND_URL = 'https://jonatan-search.onrender.com';
   ```

6. **Sube el frontend**
   - Puedes alojar `frontend/index.html` en GitHub Pages, Netlify Drop, o simplemente enviarlo por WhatsApp/email para que Jonatan lo abra en el navegador.

---

## Estructura del proyecto

```
jonatan-property-search/
├── CLAUDE.md              ← Especificación completa del sistema
├── README.md              ← Este archivo
├── backend/
│   ├── index.js           ← Servidor Express + integración Apify
│   ├── package.json
│   ├── .env.example       ← Plantilla de variables de entorno
│   └── .gitignore
└── frontend/
    └── index.html         ← Aplicación completa (UI, filtros, CRM, PDF)
```

---

## Notas

- El tier gratuito de Render duerme el servidor tras 15 min de inactividad. La primera búsqueda puede tardar 30-60 segundos en despertar.
- El tier gratuito de Apify tiene límite de uso mensual. Para uso intensivo, considera el plan de pago.
- El frontend funciona sin backend mostrando datos de ejemplo (útil para demos).
