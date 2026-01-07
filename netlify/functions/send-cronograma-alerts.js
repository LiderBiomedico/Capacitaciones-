/**
 * FUNCIÓN NETLIFY - Enviar Alertas de Cronogramas
 * Archivo: netlify/functions/send-cronograma-alerts.js
 * 
 * Enviá alertas por email cuando se aproxima una capacitación
 * Se ejecuta automáticamente diariamente
 */

const nodemailer = require('nodemailer');
const fetch = require('node-fetch');

// Configurar transporte de email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.handler = async (event) => {
  try {
    console.log('📧 Iniciando envío de alertas de cronogramas...');

    // Obtener cronogramas desde Airtable
    const cronogramas = await getCronogramasFromAirtable();
    
    if (!cronogramas || cronogramas.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No hay cronogramas' })
      };
    }

    // Revisar cada cronograma
    let alertasEnviadas = 0;

    for (const cronograma of cronogramas) {
      const capacitaciones = cronograma.fields.capacitaciones || [];

      for (const capacitacion of capacitaciones) {
        // Verificar si es necesario enviar alerta
        const debeEnviar = verificarAlerta(capacitacion);

        if (debeEnviar) {
          const enviados = await enviarAlerta(capacitacion, cronograma);
          alertasEnviadas += enviados;
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        alertasEnviadas,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Error enviando alertas:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

/**
 * Obtener cronogramas desde Airtable
 */
async function getCronogramasFromAirtable() {
  try {
    const response = await fetch('https://api.airtable.com/v0/meta/bases', {
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`
      }
    });

    const data = await response.json();
    
    // Nota: Aquí necesitarías implementar la lógica para obtener
    // los cronogramas de tu tabla de Airtable
    // Este es un ejemplo simplificado
    
    return [];

  } catch (error) {
    console.error('Error obteniendo cronogramas:', error);
    return [];
  }
}

/**
 * Verificar si debe enviarse alerta para una capacitación
 */
function verificarAlerta(capacitacion) {
  if (!capacitacion.fecha || !capacitacion.correos || capacitacion.correos.length === 0) {
    return false;
  }

  const fechaCapacitacion = new Date(capacitacion.fecha);
  const hoy = new Date();
  const diasAlerta = capacitacion.diasAlerta || 7;

  // Calcular diferencia en días
  const diffMs = fechaCapacitacion - hoy;
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // Enviar alerta si está entre X días y hoy
  return diffDias <= diasAlerta && diffDias >= 0;
}

/**
 * Enviar alerta por email
 */
async function enviarAlerta(capacitacion, cronograma) {
  try {
    const fechaCapacitacion = new Date(capacitacion.fecha);
    const hoy = new Date();
    const diffDias = Math.ceil((fechaCapacitacion - hoy) / (1000 * 60 * 60 * 24));

    // Construir mensaje de email
    const asunto = `⏰ Alerta: ${capacitacion.nombre} en ${diffDias} días`;
    
    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0066CC; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; }
            .footer { background: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; border-radius: 0 0 8px 8px; }
            .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
            .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .details p { margin: 8px 0; }
            h2 { margin-top: 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📅 Recordatorio de Capacitación</h2>
            </div>
            
            <div class="content">
              <div class="alert-box">
                <strong>⏰ ALERTA: ${diffDias} días para la capacitación</strong>
              </div>

              <h3>${capacitacion.nombre}</h3>
              
              <div class="details">
                <p><strong>📅 Fecha:</strong> ${formatearFecha(capacitacion.fecha)}</p>
                <p><strong>👥 Participantes Esperados:</strong> ${capacitacion.participantes}</p>
                <p><strong>📂 Cronograma:</strong> ${cronograma.fields.nombre}</p>
                <p><strong>📊 Año:</strong> ${cronograma.fields.año}</p>
              </div>

              <h4>Próximas Acciones:</h4>
              <ul>
                <li>Confirmar asistencia de participantes</li>
                <li>Preparar materiales de capacitación</li>
                <li>Verificar disponibilidad de sala</li>
                <li>Enviar confirmación a los asistentes</li>
              </ul>

              <p style="color: #666; font-size: 14px;">
                Este es un recordatorio automático del Sistema de Capacitaciones del Hospital.
              </p>
            </div>

            <div class="footer">
              <p>Hospital Susana López de Valencia E.S.E</p>
              <p>Departamento de Capacitación y Desarrollo</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Enviar a cada correo
    let emailsEnviados = 0;

    for (const correo of capacitacion.correos) {
      try {
        await transporter.sendMail({
          from: `"Hospital - Capacitaciones" <${process.env.EMAIL_USER}>`,
          to: correo.trim(),
          subject: asunto,
          html: htmlContent
        });

        console.log(`✅ Email enviado a: ${correo}`);
        emailsEnviados++;

      } catch (emailError) {
        console.error(`❌ Error enviando a ${correo}:`, emailError);
      }
    }

    return emailsEnviados;

  } catch (error) {
    console.error('Error en enviarAlerta:', error);
    return 0;
  }
};

/**
 * Formatear fecha para mostrar
 */
function formatearFecha(fecha) {
  try {
    const date = new Date(fecha);
    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return fecha;
  }
}
