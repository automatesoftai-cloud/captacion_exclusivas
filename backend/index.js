require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ApifyClient } = require('apify-client');

const app = express();
app.use(cors());
app.use(express.json());

const PRECIOS_MEDIA = {
  'San Pedro de Alcántara': 3200,
  'Nueva Andalucía': 4000,
  'Benahavís': 3800,
  'Estepona': 2800,
};

// Nombres de zona tal como los entiende Idealista
const ZONA_NOMBRES = {
  'San Pedro de Alcántara': 'San Pedro de Alcántara, Marbella',
  'Nueva Andalucía': 'Nueva Andalucía, Marbella',
  'Benahavís': 'Benahavís',
  'Estepona': 'Estepona',
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
      const location = ZONA_NOMBRES[zona] || zona;

      const run = await client.actor('igolaizola/idealista-scraper').call({
        operation: 'sale',
        propertyType: 'homes',
        location,
        maxItems: 25,
      });

      const { items } = await client.dataset(run.defaultDatasetId).listItems();

      if (items.length > 0) {
        console.log(`[DEBUG] Primer item de "${zona}":`, JSON.stringify(items[0], null, 2));
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
    });
  } catch (err) {
    console.error('Error en /api/search:', err);
    res.status(500).json({ error: 'Error al obtener propiedades. Revisa el token de Apify y vuelve a intentarlo.' });
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
