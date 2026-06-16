# Proyecto: Buscador de Propiedades · Jonatan

## Contexto de negocio

**ASBE** (Automation Systems for Business Empowered) es una agencia de automatización para inmobiliarias españolas.

**Cliente del sistema: Jonatan** — inversor inmobiliario independiente en Costa del Sol. Trabaja con 3-4 inversores nórdicos al año. Busca villas y adosados para reformar y revender en San Pedro de Alcántara, Nueva Andalucía, Benahavís y Estepona.

**El dolor:** Jonatan usa alertas de Idealista pero recibe demasiado ruido. Necesita un sistema que filtre automáticamente y le entregue solo oportunidades que cumplan su criterio de reforma (precio por debajo de la media de zona). Además necesita generar PDFs sin marca para enviar a sus compradores por WhatsApp.

**Lo que se le prometió:**
- Sistema de búsqueda con filtros (zona, tipo, precio máximo)
- Resultados reales de Idealista con link al anuncio original
- PDF sin marca descargable por propiedad (sin logo, sin agencia, sin contacto)
- Panel CRM simple (Nuevo / Contactado / Visitado / Descartado)

---

## Stack técnico decidido

| Capa | Tecnología | Motivo |
|------|-----------|--------|
| Frontend | HTML + Vanilla JS (ya construido) | Simple, descargable, sin build step |
| Backend | Node.js + Express | Rápido de desplegar, Claude Code lo domina |
| Scraping | Apify (actor de Idealista) | Gestiona anti-bot, tier gratuito disponible |
| Hosting | Render.com (free tier) | Sin tarjeta, despliega desde GitHub |
| PDF | Browser print API (ya implementado) | Sin dependencias, produce PDF limpio |

---

## Estructura del proyecto

```
jonatan-property-search/
├── CLAUDE.md
├── backend/
│   ├── index.js          ← servidor Express principal
│   ├── package.json
│   ├── .env.example      ← APIFY_TOKEN=xxx
│   └── .gitignore
├── frontend/
│   └── index.html        ← MVP ya construido, actualizar endpoint
└── README.md
```

---

## Backend — especificación completa

### Endpoint principal

```
POST /api/search
Content-Type: application/json

Body:
{
  "zonas": ["San Pedro de Alcántara", "Nueva Andalucía"],
  "tipo": "Ambos",           // "Villa" | "Adosado" | "Ambos"
  "precioMax": 1500000,
  "estado": "reforma"        // "reforma" | "cualquiera"
}

Response: 200 OK
{
  "results": [
    {
      "id": "string",
      "titulo": "string",
      "zona": "string",
      "tipo": "Villa" | "Adosado",
      "m2": number,
      "habitaciones": number,
      "banos": number,
      "ano": number,
      "precio": number,
      "precio_m2": number,
      "vs_media": number,        // negativo = por debajo de media zona
      "desc": "string",
      "caract": ["string"],
      "fuente": "Idealista",
      "ref": "string",
      "url": "string"            // link directo al anuncio real en Idealista
    }
  ],
  "total": number,
  "timestamp": "ISO string"
}
```

### Lógica de filtrado en backend

Precios medios de referencia por zona (€/m²):
- San Pedro de Alcántara: 3200
- Nueva Andalucía: 4000
- Benahavís: 3800
- Estepona: 2800

Filtros que aplica el backend DESPUÉS de recibir resultados de Apify:
1. Zona: que el inmueble esté en una de las zonas seleccionadas
2. Tipo: villa / adosado / ambos
3. Precio máximo: que el precio no supere el filtro
4. Estado: si es "reforma" → solo propiedades con precio/m² < media de zona (señal de oportunidad)
5. Calcular `vs_media` = ((precio/m² - media_zona) / media_zona) * 100
6. Ordenar por `vs_media` ascendente (más barato relativo a zona = primero)

### Apify — cómo llamarlo

Actor a usar: `microworlds/idealista-scraper` o `dtrungtin/idealista-scraper`
(buscar el actor más reciente y con más runs en Apify)

Parámetros que acepta el actor de Idealista:
```json
{
  "searchUrl": "https://www.idealista.com/venta-viviendas/marbella-malaga/...",
  "maxItems": 20,
  "proxyConfiguration": { "useApifyProxy": true }
}
```

Para construir la searchUrl de Idealista dinámicamente:
- Base: `https://www.idealista.com/venta-viviendas/`
- Zona: normalizar nombre a slug (ej. "San Pedro de Alcántara" → "san-pedro-de-alcantara-marbella-malaga")
- Filtros adicionales en URL: precio máximo, tipo de propiedad

Llamada a Apify desde Node.js:
```javascript
const { ApifyClient } = require('apify-client');
const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const run = await client.actor('ACTOR_ID').call({
  searchUrl: buildSearchUrl(filters),
  maxItems: 25
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();
```

### Variables de entorno necesarias

```
APIFY_TOKEN=apify_api_XXXXX
PORT=3000
FRONTEND_URL=*    // para CORS, en producción poner la URL real
```

---

## Frontend — cambios necesarios sobre el HTML existente

El archivo `frontend/index.html` ya existe y funciona con datos mock.

**Solo hay que cambiar la función `runSearch()`:**

Antes (datos mock locales):
```javascript
function doSearch() {
  let res = ALL_PROPS.filter(...);
  // ...
}
```

Después (llamada real al backend):
```javascript
async function doSearch() {
  const response = await fetch('BACKEND_URL/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      zonas: filters.zonas,
      tipo: filters.tipo,
      precioMax: filters.precioMax,
      estado: filters.estado
    })
  });
  const data = await response.json();
  currentResults = data.results;
  renderResults();
}
```

Además, en cada tarjeta de propiedad añadir botón "Ver anuncio →" que abra `p.url` en nueva pestaña.

---

## Despliegue en Render.com

1. Subir código a repositorio GitHub (público o privado)
2. En Render: New Web Service → conectar repo → seleccionar carpeta `backend/`
3. Build command: `npm install`
4. Start command: `node index.js`
5. Añadir variables de entorno: `APIFY_TOKEN`
6. Render da una URL tipo `https://jonatan-search.onrender.com`
7. Actualizar `BACKEND_URL` en el frontend con esa URL

---

## Lo que YA está construido (no tocar sin avisar)

- `frontend/index.html`: MVP completo con UI, filtros, cards, CRM kanban y generación de PDF. Funciona con datos mock. Solo actualizar la función de búsqueda y añadir el botón de link real.

---

## Criterios de éxito del MVP

- [ ] Jonatan entra a la URL del frontend
- [ ] Selecciona sus filtros (zona + tipo + precio)
- [ ] Ve propiedades reales de Idealista con link clickeable al anuncio
- [ ] Puede generar el PDF sin marca de cualquier propiedad
- [ ] Puede añadir propiedades a su panel y cambiar su estado

---

## Notas importantes

- **NUNCA mencionar** "scraping" al cliente — decir "monitorización automatizada"
- El PDF generado no debe contener ningún logo, nombre de agencia, ni datos de contacto de terceros
- El sistema B (contacto automatizado a vendedores) es una funcionalidad futura — NO está en el MVP
- Los datos de `vs_media` son el valor principal del sistema: muestran al cliente qué propiedades están por debajo del precio de mercado
