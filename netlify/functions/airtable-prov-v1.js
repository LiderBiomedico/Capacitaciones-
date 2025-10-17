const https = require('https');
const url = require('url');

exports.handler = async (event, context) => {
  console.log('Function called:', {
    httpMethod: event.httpMethod,
    path: event.path,
    body: event.body ? event.body.substring(0, 100) : 'none'
  });

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers, 
      body: 'OK' 
    };
  }

  try {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

    console.log('Env check:', {
      hasToken: !!AIRTABLE_TOKEN,
      hasBaseId: !!AIRTABLE_BASE_ID
    });

    if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
      console.error('Missing env variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Configuration Error',
          message: 'AIRTABLE_TOKEN or AIRTABLE_BASE_ID not configured',
          hasToken: !!AIRTABLE_TOKEN,
          hasBaseId: !!AIRTABLE_BASE_ID
        })
      };
    }

    let requestBody = {};
    if (event.body) {
      try {
        requestBody = JSON.parse(event.body);
      } catch (e) {
        console.error('Parse error:', e.message);
        requestBody = {};
      }
    }

    const method = requestBody.method || event.httpMethod || 'GET';
    const path = requestBody.path || event.path || '';
    const data = requestBody.data || null;

    console.log('Request:', { method, path, hasData: !!data });

    // Build Airtable URL
    const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`;
    console.log('Airtable URL:', airtableUrl);

    return new Promise((resolve) => {
      const parsedUrl = new url.URL(airtableUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: method,
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Netlify-Function'
        }
      };

      console.log('Making request:', { method, hostname: options.hostname });

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          console.log('Response:', { statusCode: res.statusCode });

          resolve({
            statusCode: res.statusCode,
            headers,
            body: responseData
          });
        });
      });

      req.on('error', (error) => {
        console.error('Request error:', error.message);
        resolve({
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: 'Connection Error',
            message: error.message
          })
        });
      });

      req.setTimeout(30000);

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });

  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Server Error',
        message: error.message
      })
    };
  }
};