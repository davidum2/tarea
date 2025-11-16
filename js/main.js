// --- 4. JavaScript para conectar con n8n ---

// ⬇️ PEGA AQUÍ TU URL DEL WEBHOOK DE N8N (Flujo 2) ⬇️
const N8N_WEBHOOK_URL = 'https://n8n.desarrollo-digital.com/webhook/bfdc997a-a717-48d1-ac3e-3eda34d3bb38';
// Webhook específico para el chat (usar para mensajes posteriores en la conversación)
const N8N_CHAT_WEBHOOK_URL = 'AQUI IRA EL WEBHOOK_DEL_CHAT_DE_N8N';

// Convertidor de Markdown
const markdownConverter = new showdown.Converter();

// Helper: escapar HTML para mostrar texto recibido sin ejecutar código (evita XSS)
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', () => {
    // Selección de elementos del DOM
    const travelForm = document.getElementById('travelForm');
    const responseContainer = document.getElementById('response-content');
    // Flag para saber si se renderizó el itinerario (para desplazarse cuando termine la carga)
    let didRenderItinerary = false;

    // --- ELEMENTOS DEL CHAT ---
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');
    const sendSpinner = document.getElementById('sendSpinner');

    // Variable para almacenar el itinerario actual
    let currentItinerary = '';
    // ID de la conversación y historial (mantener contexto entre intercambios)
    let conversationId = null;
    let conversationHistory = []; // { role: 'user'|'agent', content: '...' }

    // Escuchar el envío del formulario
    travelForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        setLoading(true);

        const formData = new FormData(travelForm);
        const payload = {
            destino: formData.get('destino'),
            duracion: parseInt(formData.get('duracion')),
            presupuesto: formData.get('presupuesto'),
            intereses: formData.getAll('intereses'),
            restricciones: formData.get('restricciones')
        };

        console.log('Enviando a n8n:', payload);

        try {
            if (N8N_WEBHOOK_URL === 'https_tu_webhook_aqui') { // Check de seguridad
                throw new Error('¡No has pegado tu URL del Webhook de n8n! (const N8N_WEBHOOK_URL)');
            }

            const response = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Error de red: ${response.statusText}`);
            }

            // 4. Manejo robusto de la respuesta: puede venir como JSON o como texto (HTML/texto plano)
            const contentType = response.headers.get('content-type') || '';
            let responseData;
            let itinerarioTexto;

            if (contentType.includes('application/json')) {
                // Si el servidor indicó JSON, intentar parsearlo
                try {
                    responseData = await response.json();
                    console.log('Respuesta completa de n8n (JSON):', responseData);
                } catch (jsonErr) {
                    console.error('Error parseando JSON desde n8n:', jsonErr);
                    const text = await response.text();
                    console.log('Respuesta (texto) recibida de n8n (falló JSON.parse):', text);
                    throw new Error('La respuesta no es JSON válido. Revisa el webhook o el nodo Respond to Webhook en n8n.');
                }
            } else {
                // No viene como JSON (por ejemplo: texto, HTML, o JSON sin content-type correcto)
                const text = await response.text();
                console.warn('Content-Type recibido desde n8n:', contentType);
                console.log('Respuesta (texto) recibida de n8n:', text);

                // Intentar parsear manually si parece JSON
                try {
                    responseData = JSON.parse(text);
                    console.log('Respuesta parseada manualmente a JSON:', responseData);
                } catch (parseErr) {
                    // No es JSON: intentar renderizarlo como Markdown/texto (útil cuando n8n devuelve markdown sin JSON)
                    console.warn('La respuesta no es JSON. Se intentará renderizar como Markdown/texto.');
                    try {
                        // Escapar primero para evitar ejecución de HTML malicioso, luego convertir Markdown a HTML
                        const safeHtml = markdownConverter.makeHtml(escapeHtml(text));
                        // Marcar que se renderizó el itinerario para luego desplazarnos
                        didRenderItinerary = true;
                        currentItinerary = text; // Guardar texto original para contexto del chat
                        renderItineraryInChat(safeHtml);
                        // Ya renderizamos el contenido, salimos del flujo normal
                        return;
                    } catch (mdErr) {
                        console.error('Error al renderizar respuesta como Markdown:', mdErr);
                        showChatError('Error al procesar la respuesta.');
                        throw new Error('La respuesta desde n8n no es JSON y falló el procesamiento como Markdown. Consulta la consola.');
                    }
                }
            }

            // 5. Extraer el texto del itinerario del JSON
            // Soportar varias estructuras comunes (directo, anidado en data[0].json, etc.)
            itinerarioTexto = responseData && (responseData.itinerario || (responseData.data && responseData.data[0] && responseData.data[0].json && responseData.data[0].json.itinerario) || responseData.body || responseData[0] && responseData[0].itinerario);
            console.log('itinerarioTexto:', itinerarioTexto);

            if (!itinerarioTexto) {
                throw new Error("La respuesta del JSON no contiene el campo 'itinerario'. Revisa el nodo 'Respond to Webhook' en n8n.");
            }

            // 6. Renderizar la respuesta (convertida de Markdown a HTML)
            const itinerarioHtml = markdownConverter.makeHtml(itinerarioTexto);
            if(responseContainer) {
                responseContainer.innerHTML = itinerarioHtml;
            }
            // Marcar que se renderizó el itinerario para luego desplazarnos
            didRenderItinerary = true;
            currentItinerary = itinerarioTexto; // Guardar para contexto del chat

        } catch (error) {
            console.error('Error al contactar n8n:', error);
            if(responseContainer) {
                responseContainer.innerHTML = `
                    <p class="text-red-600 font-medium">¡Ups! Algo salió mal.</p>
                    <p class="text-gray-700">No se pudo conectar con el planificador. Revisa la URL del Webhook y la consola (F12) para más detalles.</p>
                    <p class="text-gray-500 text-sm mt-2">${error.message}</p>
                `;
            }
        } finally {
            setLoading(false);

            // Si ya renderizamos el itinerario, mostrar la sección y desplazar al usuario
            if (didRenderItinerary) {
                try {
                    const section = document.getElementById('itinerarySection');
                    if (section) {
                        section.classList.remove('hidden');
                        section.classList.add('flex');
                    }
                } catch (e) {
                    console.warn('No se pudo modificar clases de itinerarySection:', e);
                }

                // Esperar un pequeño tiempo para que el modal se oculte visualmente
                setTimeout(() => {
                    scrollToItinerary();
                }, 180);
            }
        }
    });

    // Enviar mensaje al agente n8n
    async function sendChatMessage() {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        // Ensure conversationId
        if (!conversationId) {
            conversationId = 'conv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
            conversationHistory = [];
        }

        // Mostrar mensaje del usuario en UI y en historial
        addMessageToChat(userMessage, 'user');
        conversationHistory.push({ role: 'user', content: userMessage });
        chatInput.value = '';
        chatInput.style.height = 'auto'; // Reset height

        // Mostrar indicador de typing del agente
        const typingId = 'typing-indicator-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.className = 'message flex gap-3 justify-start';
        typingDiv.innerHTML = `<div class="message-content bg-slate-100 text-gray-700 rounded-xl px-4 py-3 prose-sm">El agente está escribiendo...</div>`;
        document.getElementById('chatMessages').appendChild(typingDiv);
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;

        // Deshabilitar botón y mostrar spinner
        sendButton.disabled = true;
        sendSpinner.classList.remove('hidden');

        try {
            // Preparar payload con contexto del itinerario, historial y pregunta del usuario
            const chatPayload = {
                conversationId,
                history: conversationHistory,
                userMessage: userMessage,
                itineraryContext: currentItinerary,
                conversationMode: true
            };

            console.log('Enviando mensaje al agente n8n (chat):', chatPayload);

            const response = await fetch(N8N_CHAT_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(chatPayload)
            });

            if (!response.ok) {
                throw new Error(`Error de red: ${response.statusText}`);
            }

            // Procesar respuesta del agente
            const contentType = response.headers.get('content-type') || '';
            let agentResponse = '';

            if (contentType.includes('application/json')) {
                try {
                    const responseData = await response.json();
                    console.log('Respuesta del agente (JSON):', responseData);
                    agentResponse = responseData.respuesta || responseData.message || responseData.response ||
                        (responseData.data && responseData.data[0] && responseData.data[0].json && responseData.data[0].json.respuesta) ||
                        (typeof responseData === 'string' ? responseData : JSON.stringify(responseData));
                } catch (jsonErr) {
                    console.error('Error parseando JSON:', jsonErr);
                    agentResponse = await response.text();
                }
            } else {
                agentResponse = await response.text();
                console.log('Respuesta del agente (texto):', agentResponse);
            }

            // Eliminar indicador de typing
            const node = document.getElementById(typingId);
            if (node) node.remove();

            // Mostrar respuesta del agente y agregarla al historial
            if (agentResponse) {
                addMessageToChat(agentResponse, 'agent');
                conversationHistory.push({ role: 'agent', content: agentResponse });
            } else {
                addMessageToChat('No pude procesar tu pregunta. Intenta de nuevo.', 'agent');
                conversationHistory.push({ role: 'agent', content: 'No pude procesar la pregunta.' });
            }

        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            // Eliminar indicador de typing si existe
            const node = document.getElementById(typingId);
            if (node) node.remove();
            addMessageToChat(`Error: ${error.message}`, 'agent');
            conversationHistory.push({ role: 'agent', content: `Error: ${error.message}` });
        } finally {
            sendButton.disabled = false;
            sendSpinner.classList.add('hidden');
            chatInput.focus();
        }
    }

    // Event listener para el botón enviar
    sendButton.addEventListener('click', sendChatMessage);

    // Event listener para Enter en el textarea
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    });
});
