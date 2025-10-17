// airtable-client.js
class AirtableClient {
  constructor(baseId = null) {
    this.baseId = baseId || localStorage.getItem('AIRTABLE_BASE_ID');
    this.functionUrl = '/.netlify/functions/airtable-prov-v1';
  }

  async request(method, path, data = null) {
    try {
      const requestBody = {
        method,
        path,
        data
      };

      console.log('🔵 Enviando request a Airtable:', { method, path });

      const response = await fetch(this.functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📊 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Error en response:', errorData);
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Respuesta exitosa:', result);
      return result;

    } catch (error) {
      console.error('❌ Error en request:', error);
      throw error;
    }
  }

  // Obtener todas las tablas
  async getTables() {
    try {
      const result = await this.request('GET', '/');
      return result.tables || [];
    } catch (error) {
      console.error('Error getting tables:', error);
      return [];
    }
  }

  // Obtener registros de una tabla
  async getRecords(tableName, options = {}) {
    try {
      let path = `/${tableName}`;
      
      if (options.formula) {
        path += `?filterByFormula=${encodeURIComponent(options.formula)}`;
      }
      
      const result = await this.request('GET', path);
      return result.records || [];
    } catch (error) {
      console.error('Error getting records:', error);
      return [];
    }
  }

  // Crear un registro
  async createRecord(tableName, fields) {
    try {
      const path = `/${tableName}`;
      const data = {
        records: [
          {
            fields
          }
        ]
      };
      
      const result = await this.request('POST', path, data);
      return result.records ? result.records[0] : null;
    } catch (error) {
      console.error('Error creating record:', error);
      throw error;
    }
  }

  // Actualizar un registro
  async updateRecord(tableName, recordId, fields) {
    try {
      const path = `/${tableName}/${recordId}`;
      const data = { fields };
      
      const result = await this.request('PATCH', path, data);
      return result;
    } catch (error) {
      console.error('Error updating record:', error);
      throw error;
    }
  }

  // Eliminar un registro
  async deleteRecord(tableName, recordId) {
    try {
      const path = `/${tableName}/${recordId}`;
      await this.request('DELETE', path);
      return true;
    } catch (error) {
      console.error('Error deleting record:', error);
      throw error;
    }
  }

  // Obtener último ID
  async getLastId(tableName) {
    try {
      const records = await this.getRecords(tableName, {
        formula: `LEN({ID}) > 0`
      });
      
      if (records.length === 0) return 0;
      
      const ids = records
        .map(r => {
          const id = r.fields.ID;
          return parseInt(id) || 0;
        })
        .sort((a, b) => b - a);
      
      return ids[0] || 0;
    } catch (error) {
      console.error('Error getting last ID:', error);
      return 0;
    }
  }
}

// Exportar para uso global
const airtableClient = new AirtableClient();
