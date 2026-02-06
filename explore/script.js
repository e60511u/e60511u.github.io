// Configuration du canvas
const canvas = document.getElementById('solarSystem');
const ctx = canvas.getContext('2d');

// Définir la taille du canvas en plein écran
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Variables de contrôle
let isPaused = false;
let animationSpeed = 1;
let time = 0;

// Centre du système solaire
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

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
    // Halo du soleil
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 35);
    gradient.addColorStop(0, 'rgba(255, 255, 100, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 200, 50, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 150, 0, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 35, 0, Math.PI * 2);
    ctx.fill();
    
    // Soleil
    const sunGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 20);
    sunGradient.addColorStop(0, '#FFF9E3');
    sunGradient.addColorStop(0.5, '#FFD700');
    sunGradient.addColorStop(1, '#FFA500');
    
    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Reflets sur le soleil
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(centerX - 5, centerY - 5, 5, 0, Math.PI * 2);
    ctx.fill();
}

// Dessiner les orbites
function drawOrbits() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    planets.forEach(planet => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, planet.orbitRadius, 0, Math.PI * 2);
        ctx.stroke();
    });
}

// Dessiner une planète
function drawPlanet(planet) {
    const x = centerX + Math.cos(planet.angle) * planet.orbitRadius;
    const y = centerY + Math.sin(planet.angle) * planet.orbitRadius;
    
    // Ombre de la planète
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, planet.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Planète
    const planetGradient = ctx.createRadialGradient(
        x - planet.radius * 0.3,
        y - planet.radius * 0.3,
        0,
        x,
        y,
        planet.radius
    );
    planetGradient.addColorStop(0, planet.color);
    planetGradient.addColorStop(1, shadeColor(planet.color, -40));
    
    ctx.fillStyle = planetGradient;
    ctx.beginPath();
    ctx.arc(x, y, planet.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Anneaux de Saturne
    if (planet.hasRings) {
        ctx.strokeStyle = 'rgba(218, 189, 145, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y, planet.radius * 1.8, planet.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Nom de la planète
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(planet.name, x, y + planet.radius + 15);
    
    // Stocker la position pour la détection de survol
    planet.x = x;
    planet.y = y;
}

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
const stars = [];
for (let i = 0; i < 200; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5,
        opacity: Math.random()
    });
}

function drawStars() {
    stars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Animation principale
function animate() {
    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dessiner les éléments
    drawStars();
    drawOrbits();
    drawSun();
    
    // Mettre à jour et dessiner les planètes
    if (!isPaused) {
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