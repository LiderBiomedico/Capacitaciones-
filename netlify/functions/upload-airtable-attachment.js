const https = require('https');

function requestJson({ hostname, path, method = 'POST', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname,
      path,
      method,
      headers: {
        ...headers,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Método no permitido' }) };
  }

  try {
    const API_KEY = process.env.AIRTABLE_API_KEY;
    const BASE_ID = process.env.AIRTABLE_BASE_ID;
    if (!API_KEY || !BASE_ID) throw new Error('Faltan AIRTABLE_API_KEY o AIRTABLE_BASE_ID en Netlify');

    const { recordId, fieldName, filename, contentType, base64 } = JSON.parse(event.body || '{}');

    if (!recordId || !fieldName || !filename || !contentType || !base64) {
      throw new Error('recordId, fieldName, filename, contentType y base64 son obligatorios');
    }

    const result = await requestJson({
      hostname: 'content.airtable.com',
      path: `/v0/${BASE_ID}/${encodeURIComponent(recordId)}/${encodeURIComponent(fieldName)}/uploadAttachment`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: {
        filename,
        contentType,
        file: base64
      }
    });

    if (result.status >= 400) {
      const msg = result.data?.error?.message || result.data?.message || result.data?.raw || `Airtable error ${result.status}`;
      return { statusCode: result.status, headers, body: JSON.stringify({ success: false, error: msg }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: result.data })
    };
  } catch (error) {
    console.error('upload-airtable-attachment error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
