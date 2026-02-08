// Configuration du canvas
const canvas = document.getElementById('solarSystem');
const ctx = canvas.getContext('2d');

// Étoiles en arrière-plan
let stars = [];
function regenerateStars() {
    stars = [];
    for (let i = 0; i < 200; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 1.5,
            opacity: Math.random(),
            baseOpacity: Math.random(),
            dx: (Math.random() - 0.5) * 0.3,
            dy: (Math.random() - 0.5) * 0.3,
            twinkleSpeed: Math.random() * 0.02 + 0.01
        });
    }
}

// Mettre à jour les positions des étoiles
function updateStars() {
    stars.forEach(star => {
        // Déplacement
        star.x += star.dx;
        star.y += star.dy;
        
        // Wrap around (réapparition de l'autre côté)
        if (star.x < 0) star.x = canvas.width;
        if (star.x > canvas.width) star.x = 0;
        if (star.y < 0) star.y = canvas.height;
        if (star.y > canvas.height) star.y = 0;
        
        // Scintillement
        star.opacity = star.baseOpacity + Math.sin(time * star.twinkleSpeed) * 0.3;
        star.opacity = Math.max(0.1, Math.min(1, star.opacity));
    });
}

// Définir la taille du canvas en plein écran
let scaleFactor = 1;
let centerX, centerY;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    centerX = canvas.width / 2;
    centerY = canvas.height / 2;
    // Calculer le facteur d'échelle pour que tout tienne dans l'écran
    // L'orbite max est 400px, on veut qu'elle tienne avec une marge
    const maxOrbit = 400;
    const margin = 10; // marge très réduite pour plus de zoom
    const available = Math.min(canvas.width, canvas.height) / 2 - margin;
    scaleFactor = available / maxOrbit;
    // Régénérer les étoiles pour le nouveau viewport
    regenerateStars();
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Variables de contrôle
let isPaused = false;
let animationSpeed = 1;
let time = 0;
let selectedPlanet = null; // Planète sélectionnée au clic

// Définition des planètes
const planets = [
    {
        name: 'Mercure',
        radius: 4,
        orbitRadius: 60,
        speed: 4.74,
        color: '#8C7853',
        info: 'Mercure - La plus petite planète, la plus proche du Soleil'
    },
    {
        name: 'Vénus',
        radius: 9,
        orbitRadius: 90,
        speed: 3.50,
        color: '#FFC649',
        info: 'Vénus - La planète la plus chaude avec une atmosphère toxique'
    },
    {
        name: 'Terre',
        radius: 10,
        orbitRadius: 120,
        speed: 2.98,
        color: '#4A90E2',
        info: 'Terre - Notre maison, la seule planète connue avec de la vie'
    },
    {
        name: 'Mars',
        radius: 6,
        orbitRadius: 150,
        speed: 2.41,
        color: '#E27B58',
        info: 'Mars - La planète rouge, future destination de l\'humanité'
    },
    {
        name: 'Jupiter',
        radius: 25,
        orbitRadius: 220,
        speed: 1.31,
        color: '#C88B3A',
        info: 'Jupiter - La plus grande planète, une géante gazeuse'
    },
    {
        name: 'Saturne',
        radius: 22,
        orbitRadius: 290,
        speed: 0.97,
        color: '#FAD5A5',
        info: 'Saturne - Célèbre pour ses magnifiques anneaux',
        hasRings: true
    },
    {
        name: 'Uranus',
        radius: 15,
        orbitRadius: 350,
        speed: 0.68,
        color: '#4FD0E7',
        info: 'Uranus - Une géante de glace qui tourne sur le côté'
    },
    {
        name: 'Neptune',
        radius: 14,
        orbitRadius: 400,
        speed: 0.54,
        color: '#4166F5',
        info: 'Neptune - La planète la plus éloignée, bleue et venteuse'
    }
];

// Position initiale aléatoire pour chaque planète
planets.forEach(planet => {
    planet.angle = Math.random() * Math.PI * 2;
});

// Dessiner le Soleil
function drawSun() {
    const sunRadius = 20 * scaleFactor;
    const haloRadius = 35 * scaleFactor;
    
    // Halo du soleil
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, haloRadius);
    gradient.addColorStop(0, 'rgba(255, 255, 100, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, haloRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Soleil
    const sunGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sunRadius);
    sunGradient.addColorStop(0, '#FFF9E3');
    sunGradient.addColorStop(0.5, '#FFD700');
    sunGradient.addColorStop(1, '#FFA500');
    
    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Reflets sur le soleil
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(centerX - sunRadius * 0.25, centerY - sunRadius * 0.25, sunRadius * 0.25, 0, Math.PI * 2);
    ctx.fill();
}

// Dessiner les orbites
function drawOrbits() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    planets.forEach(planet => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, planet.orbitRadius * scaleFactor, 0, Math.PI * 2);
        ctx.stroke();
    });
}

// Dessiner une planète
function drawPlanet(planet) {
    const scaledOrbit = planet.orbitRadius * scaleFactor;
    const scaledRadius = Math.max(planet.radius * scaleFactor, 2); // min 2px pour rester visible
    const x = centerX + Math.cos(planet.angle) * scaledOrbit;
    const y = centerY + Math.sin(planet.angle) * scaledOrbit;
    
    // Ombre de la planète
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, scaledRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Planète
    const planetGradient = ctx.createRadialGradient(
        x - scaledRadius * 0.3,
        y - scaledRadius * 0.3,
        0,
        x,
        y,
        scaledRadius
    );
    planetGradient.addColorStop(0, planet.color);
    planetGradient.addColorStop(1, shadeColor(planet.color, -40));
    
    ctx.fillStyle = planetGradient;
    ctx.beginPath();
    ctx.arc(x, y, scaledRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Anneaux de Saturne
    if (planet.hasRings) {
        ctx.strokeStyle = 'rgba(218, 189, 145, 0.7)';
        ctx.lineWidth = Math.max(2, 3 * scaleFactor);
        ctx.beginPath();
        ctx.ellipse(x, y, scaledRadius * 1.8, scaledRadius * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Cercle de sélection autour de la planète
    if (selectedPlanet === planet.name) {
        const circleSize = Math.round(scaledRadius * 3.5);
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.font = `${circleSize}px "Segoe UI Symbol", "Arial Unicode MS", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('◯', x, y + circleSize * 0.05);
        ctx.textBaseline = 'alphabetic';
    }
    
    // Nom de la planète
    let fontSize = Math.max(18, Math.round(24 * scaleFactor));
    let fontStyle = '';
    if (selectedPlanet === planet.name) {
        ctx.fillStyle = '#FF0000';
        fontStyle = 'bold ';
    } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    }
    ctx.font = `${fontStyle}${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(planet.name, x, y + scaledRadius + fontSize + 2);
    
    // Stocker la position pour la détection de survol
    planet.x = x;
    planet.y = y;
}

// Fonction pour calculer la distance entre deux points
function getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// Event listener pour le clic sur le canvas
canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    let closestPlanet = null;
    let closestDistance = Infinity;
    
    // Trouver la planète la plus proche du clic
    planets.forEach(planet => {
        const distance = getDistance(clickX, clickY, planet.x, planet.y);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestPlanet = planet.name;
        }
    });
    
    // Sélectionner la planète (ou désélectionner si on clique sur la même)
    if (selectedPlanet === closestPlanet) {
        selectedPlanet = null;
    } else {
        selectedPlanet = closestPlanet;
    }
    updatePlanetActions();
});

// Panneau d'actions planète
const planetActionsDiv = document.getElementById('planet-actions');
const btnDeselect = document.getElementById('btn-deselect');

function updatePlanetActions() {
    if (selectedPlanet) {
        planetActionsDiv.classList.remove('burst-out');
        // Force reflow pour relancer l'animation
        void planetActionsDiv.offsetWidth;
        planetActionsDiv.classList.add('slide-in');
    } else {
        planetActionsDiv.classList.remove('slide-in');
        void planetActionsDiv.offsetWidth;
        planetActionsDiv.classList.add('burst-out');
    }
}

btnDeselect.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedPlanet = null;
    updatePlanetActions();
});

// Animation du bouton Voyager
const rocketEmoji = document.getElementById('rocket-emoji');
const btnVoyager = document.getElementById('btn-voyager');
let isRocketTravelling = false;

// Fonction pour convertir le nom de la planète en nom de dossier
function planetNameToFolder(planetName) {
    const mapping = {
        'Mercure': 'mercure',
        'Vénus': 'venus',
        'Terre': 'terre',
        'Mars': 'mars',
        'Jupiter': 'jupiter',
        'Saturne': 'saturne',
        'Uranus': 'uranus',
        'Neptune': 'neptune'
    };
    return mapping[planetName] || planetName.toLowerCase();
}

btnVoyager.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isRocketTravelling || !selectedPlanet) return;
    
    isRocketTravelling = true;
    
    // Trouver la planète sélectionnée
    const targetPlanet = planets.find(p => p.name === selectedPlanet);
    if (!targetPlanet) return;
    
    // Position actuelle de la planète
    const targetX = targetPlanet.x;
    const targetY = targetPlanet.y;
    
    // Position initiale de la fusée (centre de l'élément)
    const rocketRect = rocketEmoji.getBoundingClientRect();
    const startX = rocketRect.left + rocketRect.width / 2;
    const startY = rocketRect.top + rocketRect.height / 2;
    
    // Calculer l'angle vers la planète
    const dx = targetX - startX;
    const dy = targetY - startY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90; // +90 car la fusée pointe vers le haut
    
    // Cacher les boutons
    planetActionsDiv.classList.remove('slide-in');
    void planetActionsDiv.offsetWidth;
    planetActionsDiv.classList.add('burst-out');
    
    // Lancer l'animation de la fusée
    rocketEmoji.classList.remove('resetting', 'arrived');
    rocketEmoji.classList.add('travelling');
    
    // Forcer le reflow
    void rocketEmoji.offsetWidth;
    
    // Appliquer la destination (centrer la fusée sur la planète)
    rocketEmoji.style.left = (targetX - 15) + 'px';
    rocketEmoji.style.top = (targetY - 15) + 'px';
    rocketEmoji.style.fontSize = '15px';
    rocketEmoji.style.transform = `rotate(${angle}deg)`;
    rocketEmoji.style.opacity = '0';
    
    // Après la fin de l'animation, rediriger vers la planète
    setTimeout(() => {
        // Rediriger vers le dossier de la planète
        const planetFolder = planetNameToFolder(selectedPlanet);
        window.location.href = `../${planetFolder}/`;
    }, 1500);
});

// Fonction pour assombrir une couleur
function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

// Dessiner des étoiles en arrière-plan
function drawStars() {
    const zoomCompensation = window.devicePixelRatio || 1;
    stars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius / zoomCompensation, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Animation principale
function animate() {
    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Mettre à jour et dessiner les étoiles animées
    updateStars();
    drawStars();
    
    drawOrbits();
    drawSun();
    
    // Mettre à jour et dessiner les planètes
    if (!isPaused) {
        time += 1;
        planets.forEach(planet => {
            planet.angle += (planet.speed * 0.001 * animationSpeed);
        });
        time += animationSpeed;
    }
    
    planets.forEach(planet => {
        drawPlanet(planet);
    });
    
    requestAnimationFrame(animate);
}

// Démarrer l'animation
animate();