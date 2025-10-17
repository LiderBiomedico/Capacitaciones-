const https = require('https');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Missing Airtable configuration',
        message: 'Please configure AIRTABLE_TOKEN and AIRTABLE_BASE_ID in Netlify environment variables'
      })
    };
  }

  try {
    let body;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch (e) {
      body = {};
    }

    const method = body.method || 'GET';
    const path = body.path || '';
    const data = body.body || null;

    // Special endpoint for config check
    if (path === '/config') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          configured: true,
          baseId: AIRTABLE_BASE_ID 
        })
      };
    }

    // Make request to Airtable
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`;
    
    return new Promise((resolve, reject) => {
      const url = new URL(airtableUrl);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers,
            body: responseData
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: error.message,
            details: 'Failed to connect to Airtable API'
          })
        });
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};