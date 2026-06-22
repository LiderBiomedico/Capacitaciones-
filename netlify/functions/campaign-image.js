// netlify/functions/campaign-image.js
// ============================================================================
// Sirve la imagen de una campaña previamente guardada en Netlify Blobs.
// Se usa como destino del <img src> dentro del correo de publicidad.
//
// Entrada (GET): ?id=XXXX
// Salida: la imagen con su Content-Type (binario).
// ============================================================================

exports.handler = async (event) => {
  const id = (event.queryStringParameters && event.queryStringParameters.id) ? String(event.queryStringParameters.id) : '';
  if (!id || !/^[a-f0-9]{8,64}$/i.test(id)) {
    return { statusCode: 400, body: 'Solicitud inválida.' };
  }

  let getStore;
  try { ({ getStore } = require('@netlify/blobs')); }
  catch (e) { return { statusCode: 500, body: 'Almacenamiento no disponible.' }; }

  try {
    let store;
    try {
      store = getStore('campaign-images');
    } catch (e) {
      const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID || '';
      const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN || '';
      if (!siteID || !token) return { statusCode: 500, body: 'Almacenamiento no disponible.' };
      store = getStore({ name: 'campaign-images', siteID, token });
    }

    const blob = await store.getWithMetadata(id, { type: 'arrayBuffer' });
    if (!blob || !blob.data) {
      return { statusCode: 404, body: 'Imagen no encontrada.' };
    }
    const buf = Buffer.from(blob.data);
    const contentType = (blob.metadata && blob.metadata.contentType) ? String(blob.metadata.contentType) : 'image/jpeg';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      },
      body: buf.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    console.error('Error sirviendo imagen de campaña:', e);
    return { statusCode: 500, body: 'Error al cargar la imagen.' };
  }
};
