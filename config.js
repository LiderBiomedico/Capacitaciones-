// ==========================================
// config.js - Configuración del Sistema
// ==========================================

const CONFIG = {
    APP_NAME: 'Sistema de Capacitaciones',
    HOSPITAL_NAME: 'Hospital Susana López de Valencia',
    VERSION: '1.0.0',
    MAX_QUESTIONS_PER_EXAM: 10,
    
    // Nombres de tablas en Airtable
    TABLES: {
        TRAININGS: 'Capacitaciones',
        PARTICIPANTS: 'Participantes',
        RESULTS: 'Resultados',
        QUESTIONS: 'Preguntas',
        ANSWERS: 'Respuestas'
    },
    
    // Campos de Airtable
    FIELDS: {
        TRAININGS: {
            ID: 'ID',
            TITLE: 'Capacitacion',
            OBJECTIVE: 'Objetivo',
            TOPICS: 'Temas',
            DATE: 'Fecha',
            INSTRUCTOR: 'Expositor',
            DEPARTMENT: 'Departamento',
            DURATION: 'Duracion',
            STAFF: 'PersonalCapacitado',
            METHODOLOGY: 'Metodologia',
            PLANNING: 'Planeacion',
            PROCESS: 'ProcesoAtencion',
            ACCESS_CODE: 'CodigoAcceso',
            STATUS: 'Estado',
            CREATED_AT: 'FechaCreacion'
        },
        QUESTIONS: {
            TRAINING_ID: 'CapacitacionID',
            TYPE: 'Tipo',
            NUMBER: 'Numero',
            QUESTION: 'Pregunta',
            OPTION_A: 'OpcionA',
            OPTION_B: 'OpcionB',
            OPTION_C: 'OpcionC',
            OPTION_D: 'OpcionD',
            CORRECT_ANSWER: 'RespuestaCorrecta'
        },
        PARTICIPANTS: {
            TRAINING_ID: 'CapacitacionID',
            NAME: 'Nombre',
            EMAIL: 'Email',
            POSITION: 'Cargo',
            REGISTERED_AT: 'FechaRegistro',
            COMPLETED: 'Completado'
        },
        RESULTS: {
            PARTICIPANT_ID: 'ParticipanteID',
            PRETEST_SCORE: 'PretestScore',
            POSTTEST_SCORE: 'PosttestScore',
            IMPROVEMENT: 'Mejora',
            COMPLETED_AT: 'FechaCompletado'
        }
    }
};

// ==========================================
// Función de Request a Airtable via Netlify Function
// ==========================================

async function airtableRequest(method, path, data = null) {
    try {
        const response = await fetch('/.netlify/functions/airtable-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                method: method,
                path: path,
                body: data
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        console.error('Airtable request error:', error);
        throw error;
    }
}

// Hacer disponible globalmente
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
    window.airtableRequest = airtableRequest;
}