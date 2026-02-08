// Configuration des endpoints
const ISSUE_TOKEN_ENDPOINT = '/issue-token'; // Ajustez selon votre config
const SEND_MESSAGE_ENDPOINT = '/send-message'; // Ajustez selon votre config

// Variables globales
let token = null;
let hashes = null;

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
    
    const response = await fetch(ISSUE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(hashes)
    });

    const data = await response.json();

    if (data.success) {
      token = data.token;
      hideStatus();
      enableForm();
    } else {
      showStatus(`Erreur: ${data.error}`, 'error');
      disableForm();
    }
  } catch (err) {
    showStatus('Erreur de connexion au serveur', 'error');
    disableForm();
  }
}

// Envoyer le message
async function sendMessage(message) {
  try {
    const response = await fetch(SEND_MESSAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token,
        ...hashes,
        message
      })
    });

    const data = await response.json();

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
    showStatus('❌ Erreur de connexion au serveur', 'error');
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
