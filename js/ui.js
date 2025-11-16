// --- ELEMENTOS DEL POPUP ---
const loadingModal = document.getElementById('loadingModal');
const loadingMessage = document.getElementById('loadingMessage');

// --- Carrusel de texto de carga ---
let messageInterval;
let currentMessageIndex = 0;
const loadingMessages = [
    "Procesando tu información...",
    "Consultando guías de viaje (RAG)...",
    "Cargando destinos...",
    "Revisando reseñas locales...",
    "Configurando tu experiencia...",
    "Casi listo..."
];

// Función de carga
function setLoading(isLoading) {
    const submitButton = document.getElementById('submitButton');
    const buttonText = document.getElementById('button-text');
    const buttonSpinner = document.getElementById('button-spinner');

    if (isLoading) {
        submitButton.disabled = true;
        buttonText.classList.add('hidden');
        buttonSpinner.classList.remove('hidden');
        loadingModal.classList.remove('hidden');
        loadingMessage.textContent = loadingMessages[0];
        loadingMessage.classList.add('animate-fade-in-out');
        currentMessageIndex = 1;
        messageInterval = setInterval(() => {
            loadingMessage.textContent = loadingMessages[currentMessageIndex];
            currentMessageIndex = (currentMessageIndex + 1) % loadingMessages.length;
        }, 2000);
    } else {
        submitButton.disabled = false;
        buttonText.classList.remove('hidden');
        buttonSpinner.classList.add('hidden');
        loadingModal.classList.add('hidden');
        clearInterval(messageInterval);
        loadingMessage.classList.remove('animate-fade-in-out');
    }
}

// --- FUNCIONES DEL CHAT ---

// Mostrar itinerario en el chat y activar la ventana
function renderItineraryInChat(htmlContent) {
    const chatMessages = document.getElementById('chatMessages');
    const respuestaIAContainer = document.getElementById('respuestaIA');
    const chatFooter = document.getElementById('chatFooter');

    chatMessages.innerHTML = `<div class="prose prose-indigo max-w-none w-full">${htmlContent}</div>`;
    respuestaIAContainer.classList.remove('hidden');
    respuestaIAContainer.classList.add('flex');
    chatFooter.classList.remove('hidden');
    chatFooter.classList.add('flex');
}

// Mostrar error en el chat
function showChatError(errorMsg) {
    const chatMessages = document.getElementById('chatMessages');
    const respuestaIAContainer = document.getElementById('respuestaIA');

    chatMessages.innerHTML = `<p class="text-red-600 font-medium">${errorMsg}</p>`;
    respuestaIAContainer.classList.remove('hidden');
    respuestaIAContainer.classList.add('flex');
    // No mostrar input en caso de error
}

// Agregar mensaje a la conversación (renderiza Markdown seguro para respuestas del agente)
function addMessageToChat(text, senderType) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message flex gap-3 ${senderType === 'user' ? 'justify-end' : 'justify-start'}`;
    const bubbleBase = 'message-content max-w-xs px-4 py-3 break-words';
    if (senderType === 'user') {
        const contentClass = 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl rounded-br-sm';
        messageDiv.innerHTML = `<div class="${bubbleBase} ${contentClass}">${escapeHtml(text)}</div>`;
    } else {
        // Agent: treat text as Markdown, but escape first to avoid raw HTML
        const safeHtml = markdownConverter.makeHtml(escapeHtml(text));
        const contentClass = 'bg-slate-100 text-gray-900 rounded-xl rounded-bl-sm prose prose-sm';
        messageDiv.innerHTML = `<div class="${bubbleBase} ${contentClass}">${safeHtml}</div>`;
    }
    chatMessages.appendChild(messageDiv);
    // Scroll al final
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// Animations: activar clases 'in-view' en elementos con .fade-up al entrar en viewport
(function() {
    try {
        const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) return;

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
    } catch (e) {
        console.warn('Animaciones de entrada no disponibles:', e);
    }
})();

// Función para desplazar al usuario a la sección del itinerario personalizado
function scrollToItinerary() {
    try {
        const el = document.getElementById('itinerarySection') || document.getElementById('respuestaIA');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (e) {
        console.warn('No se pudo desplazar al itinerario:', e);
    }
}
