// Configuration Appwrite
const APPWRITE_CONFIG = {
  endpoint: 'https://fra.cloud.appwrite.io/v1',
  projectId: '6982170a001770ae03c0'
};

// IDs des fonctions Appwrite
const FUNCTION_IDS = {
  ISSUE_TOKEN: '6987d01100214476ed77',
  SEND_MESSAGE: '698678230016ad0bbe15',
  LOAD_MESSAGES: '698b0813000322ce40dc',
  LOAD_MESSAGES_ADAPTIVE: '698b0813000322ce40dc'
};

// Fonction utilitaire pour exécuter les fonctions Appwrite via REST API
async function executeAppwriteFunction(functionId, payload) {
  const url = `${APPWRITE_CONFIG.endpoint}/functions/${functionId}/executions`;
  
  try {
    console.log(`[Appwrite] Calling function ${functionId}...`);
    console.log(`[Appwrite] URL: ${url}`);
    console.log(`[Appwrite] Payload:`, payload);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': APPWRITE_CONFIG.projectId,
      },
      body: JSON.stringify({
        body: JSON.stringify(payload)
      })
    });
    
    console.log(`[Appwrite] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Appwrite] HTTP ${response.status}: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`[Appwrite] Response data:`, data);
    
    // Parse responseBody if it's a string (common with Appwrite functions)
    if (typeof data.responseBody === 'string') {
      return JSON.parse(data.responseBody);
    }
    
    return data;
  } catch (err) {
    console.error(`[Appwrite ERROR] Function ${functionId}:`, err);
    throw err;
  }
}

// Variables globales
let token = null;
let hashes = null;

// Variables pour la gestion de la pagination des messages
let messagesOffset = 0;
const messagesLimit = 20;
let isLoadingMessages = false;
let allMessagesLoaded = false;
let lastMessagesScrollPosition = 0;

// Variables pour l'optimisation adaptative
let averageMessageHeight = 70; // Hauteur estimée d'un message
let allLoadedMessages = []; // Cache de tous les messages chargés
let useAdaptiveLoading = true; // Basculer avec adaptiveLoading si la fonction n'existe pas

// Variables pour le throttling du scroll
let scrollThrottleTimer = null;
const SCROLL_THROTTLE_MS = 500; // Attendre 500ms avant de recharger

// Fonction pour obtenir les dimensions du viewport
function getViewportDimensions() {
  const container = document.getElementById('chatMessages');
  return {
    height: container.clientHeight,
    width: container.clientWidth,
    scrollTop: container.scrollTop,
    scrollHeight: container.scrollHeight
  };
}

// Fonction throttle pour éviter les appels excessifs
function throttleScroll(callback, delay) {
  if (scrollThrottleTimer) return;
  
  scrollThrottleTimer = setTimeout(() => {
    callback();
    scrollThrottleTimer = null;
  }, delay);
}

// Déterminer les messages visibles dans le viewport
function getVisibleMessageRange() {
  const container = document.getElementById('chatMessages');
  const messages = container.querySelectorAll('.message-item');
  const containerRect = container.getBoundingClientRect();
  
  let firstVisibleIndex = -1;
  let lastVisibleIndex = -1;
  
  messages.forEach((msg, index) => {
    const msgRect = msg.getBoundingClientRect();
    const isVisible = (
      msgRect.bottom > containerRect.top && 
      msgRect.top < containerRect.bottom
    );
    
    if (isVisible) {
      if (firstVisibleIndex === -1) firstVisibleIndex = index;
      lastVisibleIndex = index;
    }
  });
  
  return {
    firstVisibleIndex,
    lastVisibleIndex,
    totalMessages: messages.length,
    isNearTop: container.scrollTop < 100,
    isNearBottom: (container.scrollHeight - container.scrollTop - container.clientHeight) < 100
  };
}

// Génération des hashes côté client (seulement ua_hash et fp_hash)
// ipHash est généré côté serveur à partir de l'IP réelle
async function generateHashes() {
  const encoder = new TextEncoder();
  
  // User-Agent hash
  const uaString = navigator.userAgent;
  const uaBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(uaString));
  const ua_hash = Array.from(new Uint8Array(uaBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Fingerprint hash (basé sur plusieurs caractéristiques du navigateur)
  const fpData = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    navigator.deviceMemory || 'unknown',
    navigator.platform
  ].join('|');
  
  const fpBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(fpData));
  const fp_hash = Array.from(new Uint8Array(fpBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return { ua_hash, fp_hash };
}

// Obtenir un token au chargement de la page
async function obtainToken() {
  try {
    showStatus('Obtention du token...', 'info');
    
    hashes = await generateHashes();
    console.log('[Token] Generated hashes:', hashes);
    
    const data = await executeAppwriteFunction(
      FUNCTION_IDS.ISSUE_TOKEN,
      hashes
    );

    if (data.success) {
      token = data.token;
      console.log('[Token] Token obtained successfully:', token);
      hideStatus();
      enableForm();
    } else {
      console.error('[Token] Error from function:', data.error);
      showStatus(`Erreur: ${data.error}`, 'error');
      disableForm();
    }
  } catch (err) {
    console.error('[Token] Error:', err);
    showStatus('❌ Erreur de connexion au serveur: ' + err.message, 'error');
    disableForm();
  }
}

// Charger et afficher les messages du chat avec système adaptatif
async function loadChatMessages(isInitial = false, loadOlder = false) {
  // Éviter les chargements simultanés
  if (isLoadingMessages) return;
  
  // Si tous les messages sont chargés et ce n'est pas un chargement de nouveaux messages
  if (allMessagesLoaded && !isInitial && !loadOlder) return;
  
  isLoadingMessages = true;
  
  try {
    const messagesContainer = document.getElementById('chatMessages');
    const viewport = getViewportDimensions();
    
    // Déterminer l'offset selon le type de chargement
    let offset = isInitial ? 0 : messagesOffset;
    
    // Utiliser le chargement adaptatif si disponible (POUR TOUS LES CAS: initial, scroll, refresh)
    if (useAdaptiveLoading) {
      return await loadChatMessagesAdaptive(isInitial, loadOlder);
    }
    
    // Fallback au chargement classique
    const data = await executeAppwriteFunction(
      FUNCTION_IDS.LOAD_MESSAGES,
      {
        limit: messagesLimit,
        offset: offset
      }
    );

    if (data && Array.isArray(data)) {
      // Premier chargement
      if (isInitial) {
        messagesContainer.innerHTML = '';
        messagesOffset = 0;
        allMessagesLoaded = false;
        
        if (data.length === 0) {
          messagesContainer.innerHTML = '<div class="no-messages">Aucun message pour le moment. Soyez le premier à envoyer un message !</div>';
          isLoadingMessages = false;
          return;
        }
      }
      
      // Vérifier si c'est le dernier lot de messages
      if (data.length < messagesLimit) {
        allMessagesLoaded = true;
      }
      
      if (data.length > 0) {
        // Trier les messages par date croissante (anciens en premier)
        const sortedMessages = data.sort((a, b) => {
          const dateA = new Date(a.created_at || a.timestamp || 0);
          const dateB = new Date(b.created_at || b.timestamp || 0);
          return dateA - dateB;
        });
        
        // Sauvegarder la position de scroll actuelle
        lastMessagesScrollPosition = messagesContainer.scrollTop;
        const previousHeight = messagesContainer.scrollHeight;
        
        // Ajouter les nouveaux messages au début ou à la fin selon le type de chargement
        if (loadOlder) {
          // Ajouter les anciens messages en haut
          const fragment = document.createDocumentFragment();
          sortedMessages.forEach(msg => {
            fragment.appendChild(createMessageElement(msg));
          });
          messagesContainer.insertBefore(fragment, messagesContainer.firstChild);
          
          // Maintenir la position de l'utilisateur
          const newHeight = messagesContainer.scrollHeight;
          messagesContainer.scrollTop = lastMessagesScrollPosition + (newHeight - previousHeight);
          
          messagesOffset += data.length;
        } else if (isInitial) {
          // Premier chargement - ajouter les messages
          const fragment = document.createDocumentFragment();
          sortedMessages.forEach(msg => {
            fragment.appendChild(createMessageElement(msg));
          });
          messagesContainer.appendChild(fragment);
          // Scroll vers le bas pour les nouveaux messages
          setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }, 0);
          
          messagesOffset = data.length;
        } else {
          // Rafraîchissement (nouveaux messages) - ajouter à la fin
          const fragment = document.createDocumentFragment();
          sortedMessages.forEach(msg => {
            fragment.appendChild(createMessageElement(msg));
          });
          messagesContainer.appendChild(fragment);
          // Scroll vers le bas
          setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }, 0);
        }
      }
    } else {
      if (isInitial) {
        messagesContainer.innerHTML = '<div class="no-messages">Erreur au chargement des messages</div>';
      }
    }
  } catch (err) {
    console.error('[LoadMessages] Error:', err);
    if (isInitial) {
      const messagesContainer = document.getElementById('chatMessages');
      messagesContainer.innerHTML = `<div class="no-messages">❌ Erreur de connexion: ${err.message}</div>`;
    }
  } finally {
    isLoadingMessages = false;
  }
}

// Charger les messages avec système adaptatif (optimisé pour le viewport de l'utilisateur)
async function loadChatMessagesAdaptive(isInitial = false, loadOlder = false) {
  try {
    const messagesContainer = document.getElementById('chatMessages');
    const viewport = getViewportDimensions();
    
    // Déterminer l'offset
    let offset = isInitial ? 0 : messagesOffset;
    
    // Préparer les paramètres pour la fonction adaptative
    const adaptiveParams = {
      limit: messagesLimit,
      offset: offset,
      viewportHeight: viewport.height,
      scrollPosition: viewport.scrollTop,
      messageHeight: averageMessageHeight
    };

    const responseData = await executeAppwriteFunction(
      FUNCTION_IDS.LOAD_MESSAGES_ADAPTIVE,
      adaptiveParams
    );

    // Gérer la réponse adaptative
    if (responseData.success && responseData.data && Array.isArray(responseData.data)) {
      const data = responseData.data;
      const metadata = responseData.metadata || {};

      // Cache les messages chargés pour analyse
      if (isInitial) {
        allLoadedMessages = [...data];
        messagesContainer.innerHTML = '';
        messagesOffset = 0;
        allMessagesLoaded = false;
      }

      if (data.length === 0) {
        if (isInitial) {
          messagesContainer.innerHTML = '<div class="no-messages">Aucun message pour le moment. Soyez le premier à envoyer un message !</div>';
        }
        isLoadingMessages = false;
        return;
      }

      // Mettre à jour la hauteur moyenne des messages en fonction des messages affichés
      updateAverageMessageHeight(messagesContainer);

      // Vérifier si c'est le dernier lot
      if (metadata.isOptimized && metadata.total) {
        allMessagesLoaded = (allLoadedMessages.length >= metadata.total);
      } else {
        allMessagesLoaded = (data.length < messagesLimit);
      }

      if (data.length > 0) {
        // Trier les messages par date croissante
        const sortedMessages = data.sort((a, b) => {
          const dateA = new Date(a.created_at || a.timestamp || 0);
          const dateB = new Date(b.created_at || b.timestamp || 0);
          return dateA - dateB;
        });

        lastMessagesScrollPosition = messagesContainer.scrollTop;
        const previousHeight = messagesContainer.scrollHeight;

        if (loadOlder) {
          // Ajouter les anciens messages en haut
          const fragment = document.createDocumentFragment();
          sortedMessages.forEach(msg => {
            fragment.appendChild(createMessageElement(msg));
          });
          messagesContainer.insertBefore(fragment, messagesContainer.firstChild);

          const newHeight = messagesContainer.scrollHeight;
          messagesContainer.scrollTop = lastMessagesScrollPosition + (newHeight - previousHeight);
          messagesOffset += data.length;
        } else if (isInitial) {
          const fragment = document.createDocumentFragment();
          sortedMessages.forEach(msg => {
            fragment.appendChild(createMessageElement(msg));
          });
          messagesContainer.appendChild(fragment);
          setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }, 0);
          messagesOffset = data.length;
        } else {
          // Nouveaux messages à la fin
          const fragment = document.createDocumentFragment();
          sortedMessages.forEach(msg => {
            fragment.appendChild(createMessageElement(msg));
          });
          messagesContainer.appendChild(fragment);
          setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }, 0);
        }
      }
    } else {
      // Fallback si la fonction adaptative échoue
      console.warn('Adaptive loading failed, falling back to legacy loading');
      useAdaptiveLoading = false;
      await loadChatMessages(isInitial, loadOlder);
    }
  } catch (err) {
    console.error('[LoadMessagesAdaptive] Error:', err);
    // Fallback au chargement classique
    useAdaptiveLoading = false;
    try {
      await loadChatMessages(isInitial, loadOlder);
    } catch (fallbackErr) {
      console.error('[LoadMessagesAdaptive Fallback] Error:', fallbackErr);
    }
  } finally {
    isLoadingMessages = false;
  }
}

// Mettre à jour la hauteur moyenne estimée des messages
function updateAverageMessageHeight(container) {
  const messages = container.querySelectorAll('.message-item');
  if (messages.length > 0) {
    let totalHeight = 0;
    messages.forEach(msg => {
      totalHeight += msg.clientHeight;
    });
    averageMessageHeight = totalHeight / messages.length;
  }
}
// Créer un élément de message
function createMessageElement(msg) {
  const messageEl = document.createElement('div');
  messageEl.className = 'message-item';
  
  const timestamp = msg.created_at || msg.timestamp || new Date().toISOString();
  const date = new Date(timestamp);
  const timeStr = date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  messageEl.innerHTML = `
    <div class="message-content">
      <p class="message-text">${escapeHtml(msg.message || msg.text || '')}</p>
      <p class="message-time">${timeStr}</p>
    </div>
  `;
  
  return messageEl;
}

// Fonction utilitaire pour échapper les caractères HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Envoyer le message
async function sendMessage(message) {
  try {
    const data = await executeAppwriteFunction(
      FUNCTION_IDS.SEND_MESSAGE,
      {
        token,
        ...hashes,
        message
      }
    );

    if (data.success) {
      showStatus('✅ Message envoyé avec succès !', 'success');
      document.getElementById('message').value = '';
      updateCharCounter();
      disableForm();
      
      // Réinitialiser après 5 secondes
      setTimeout(() => {
        hideStatus();
      }, 5000);
    } else {
      showStatus(`❌ ${data.error}`, 'error');
      
      // Si le token est invalide, tenter de le régénérer
      if (data.error.includes('token') || data.error.includes('Token')) {
        setTimeout(() => {
          obtainToken();
        }, 3000);
      }
    }
  } catch (err) {
    console.error('[SendMessage] Error:', err);
    showStatus('❌ Erreur de connexion au serveur: ' + err.message, 'error');
  }
}

// Afficher un message de statut
function showStatus(message, type) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.style.display = 'block';
}

// Masquer le message de statut
function hideStatus() {
  const statusEl = document.getElementById('status');
  statusEl.style.display = 'none';
}

// Activer le formulaire
function enableForm() {
  document.getElementById('message').disabled = false;
  document.getElementById('submitBtn').disabled = false;
}

// Désactiver le formulaire
function disableForm() {
  document.getElementById('message').disabled = true;
  document.getElementById('submitBtn').disabled = true;
}

// Mettre à jour le compteur de caractères
function updateCharCounter() {
  const messageInput = document.getElementById('message');
  const counter = document.getElementById('charCounter');
  const length = messageInput.value.length;
  
  counter.textContent = `${length} / 50`;
  
  if (length >= 50) {
    counter.classList.add('error');
    counter.classList.remove('warning');
  } else if (length >= 40) {
    counter.classList.add('warning');
    counter.classList.remove('error');
  } else {
    counter.classList.remove('warning', 'error');
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Désactiver le formulaire au départ
  disableForm();
  
  // Obtenir le token
  obtainToken();
  
  // Charger les messages du chat (premier chargement)
  loadChatMessages(true);
  
  // Rafraîchir les nouveaux messages toutes les 5 secondes
  setInterval(() => loadChatMessages(false, false), 5000);
  
  // Ajouter le listener pour le scroll vers le haut - amélioré avec adaptive loading
  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer.addEventListener('scroll', () => {
    throttleScroll(() => {
      const visibleRange = getVisibleMessageRange();
      
      // Charger les anciens messages si proche du top
      if (visibleRange.isNearTop && !allMessagesLoaded && !isLoadingMessages) {
        loadChatMessages(false, true);
      }
      
      // Optionnel : charger les nouveaux messages si près du bottom
      if (visibleRange.isNearBottom && !isLoadingMessages) {
        // Forcer un rafraîchissement intelligent
        const viewport = getViewportDimensions();
        updateAverageMessageHeight(messagesContainer);
      }
    }, SCROLL_THROTTLE_MS);
  });
  
  // Compteur de caractères
  const messageInput = document.getElementById('message');
  messageInput.addEventListener('input', updateCharCounter);
  
  // Soumission du formulaire
  const form = document.getElementById('messageForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    
    if (!message) {
      showStatus('⚠️ Veuillez entrer un message', 'error');
      return;
    }
    
    if (message.length > 50) {
      showStatus('⚠️ Message trop long (max 50 caractères)', 'error');
      return;
    }
    
    if (!token) {
      showStatus('⚠️ Token non disponible, rechargement...', 'error');
      obtainToken();
      return;
    }
    
    // Désactiver le bouton pendant l'envoi
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span>Envoi en cours...';
    
    await sendMessage(message);
    
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  });
});
