require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ApifyClient } = require('apify-client');

const app = express();
app.use(cors());
app.use(express.json());

// Precios medios €/m² actualizados enero 2026 (fuente: Idealista)
const PRECIOS_MEDIA = {
  'San Pedro de Alcántara': 4800,
  'Nueva Andalucía': 5600,
  'Benahavís': 5200,
  'Estepona': 3800,
};

// URLs reales de Idealista por zona (chalets = villas + adosados)
const ZONA_URLS = {
  'San Pedro de Alcántara': 'https://www.idealista.com/venta-viviendas/marbella/san-pedro-de-alcantara/con-chalets/',
  'Nueva Andalucía':        'https://www.idealista.com/venta-viviendas/marbella/nueva-andalucia/con-chalets/',
  'Benahavís':              'https://www.idealista.com/venta-viviendas/benahavis-malaga/con-chalets/',
  'Estepona':               'https://www.idealista.com/venta-viviendas/estepona-malaga/con-chalets/',
};

function normalizeItem(item, zona) {
  // igolaizola/idealista-scraper devuelve: price, size, rooms, bathrooms, url, description, propertyType, floor, exterior, etc.
  const precio = item.price ?? item.priceInfo?.amount ?? item.precio ?? 0;
  const m2 = item.size ?? item.superficie ?? item.m2 ?? 0;
  const precio_m2 = m2 > 0 ? Math.round(precio / m2) : 0;
  const media = PRECIOS_MEDIA[zona] || 3500;
  const vs_media = media > 0 ? Math.round(((precio_m2 - media) / media) * 100) : 0;

  const tipoRaw = (
    (item.propertyType || '') + ' ' +
    (item.typology || '') + ' ' +
    (item.title || '') + ' ' +
    (item.description || '')
  ).toLowerCase();
  const tipo = (tipoRaw.includes('adosado') || tipoRaw.includes('duplex') || tipoRaw.includes('townhouse'))
    ? 'Adosado' : 'Villa';

  const titulo = item.title || item.address || item.propertyType || `${tipo} en ${zona}`;

  const caract = [];
  if (item.exterior) caract.push('Exterior');
  if (item.floor) caract.push(`Planta ${item.floor}`);
  if (item.hasGarage || item.garage) caract.push('Garaje');
  if (item.hasGarden || item.garden) caract.push('Jardín');
  if (item.hasSwimmingPool || item.swimmingPool) caract.push('Piscina');
  if (item.hasTerrace || item.terrace) caract.push('Terraza');

  return {
    id: String(item.id || item.propertyCode || Math.random().toString(36).slice(2)),
    titulo,
    zona,
    tipo,
    m2,
    habitaciones: item.rooms ?? item.bedrooms ?? item.habitaciones ?? 0,
    banos: item.bathrooms ?? item.banos ?? 0,
    ano: item.constructedYear ?? item.yearBuilt ?? item.ano ?? null,
    precio,
    precio_m2,
    vs_media,
    desc: item.description ?? item.desc ?? '',
    caract,
    fuente: 'Idealista',
    ref: String(item.propertyCode || item.id || ''),
    url: item.url ?? item.propertyUrl ?? item.link ?? '',
    imagen: item.thumbnail ?? item.images?.[0] ?? item.photos?.[0] ?? item.mainImage ?? '',
  };
}

app.post('/api/search', async (req, res) => {
  const { zonas = [], tipo = 'Ambos', precioMax, estado = 'cualquiera' } = req.body;

  if (!zonas.length) {
    return res.status(400).json({ error: 'Debes seleccionar al menos una zona.' });
  }

  if (!process.env.APIFY_TOKEN) {
    return res.status(500).json({ error: 'APIFY_TOKEN no configurado en el servidor.' });
  }

  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

  try {
    let allItems = [];

    for (const zona of zonas) {
      const searchUrl = ZONA_URLS[zona];
      if (!searchUrl) continue;

      console.log(`[Apify] Buscando "${zona}" → ${searchUrl}`);

      console.log(`[Apify] Llamando actor con URL: ${searchUrl}`);
      const run = await client.actor('crawlerbros/idealista-scraper').call({
        startUrls: [{ url: searchUrl }],
        location: 'marbella-malaga',
        maxItems: 25,
        proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
      });

      console.log(`[Apify] Run status: ${run.status}, datasetId: ${run.defaultDatasetId}`);
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      console.log(`[Apify] ${items.length} resultados en "${zona}"`);

      if (items.length > 0) {
        console.log(`[DEBUG] Campos disponibles:`, Object.keys(items[0]));
        console.log(`[DEBUG] Primer item:`, JSON.stringify(items[0], null, 2));
      } else {
        console.log(`[WARN] 0 items devueltos. Run completo:`, JSON.stringify(run, null, 2));
      }

      for (const item of items) {
        allItems.push(normalizeItem(item, zona));
      }
    }

    // Filtro por tipo
    if (tipo !== 'Ambos') {
      allItems = allItems.filter(p => p.tipo === tipo);
    }

    // Filtro por precio máximo
    if (precioMax) {
      allItems = allItems.filter(p => p.precio <= precioMax);
    }

    // Filtro por estado (reforma = por debajo de media de zona)
    if (estado === 'reforma') {
      allItems = allItems.filter(p => p.vs_media < 0);
    }

    // Ordenar por vs_media ascendente (más barato relativo primero)
    allItems.sort((a, b) => a.vs_media - b.vs_media);

    res.json({
      results: allItems,
      total: allItems.length,
      timestamp: new Date().toISOString(),
      source: allItems.length > 0 ? 'idealista' : 'empty',
    });
  } catch (err) {
    console.error('Error en /api/search:', err);
    res.status(500).json({
      error: 'Error al obtener propiedades.',
      detail: err.message,
    });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
