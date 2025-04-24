const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const livesEl = document.getElementById('lives');
const moneyEl = document.getElementById('money');
const waveEl = document.getElementById('wave');
const startWaveBtn = document.getElementById('startWaveBtn');
const gameOverEl = document.getElementById('gameOver');
const placementIndicator = document.getElementById('placement-indicator');
const towerCostEl = document.getElementById('towerCost');

// --- Game Constants ---
// (Constants remain largely the same)
const TILE_SIZE = 40;
const TOWER_COST = 50;
const TOWER_RANGE = 120;
const TOWER_FIRE_RATE = 60;
const PROJECTILE_SPEED = 6;
const PROJECTILE_DAMAGE = 1;
const BASE_BALLOON_SPEED = 1;
const BALLOON_RADIUS = 15;
const TOWER_RADIUS = 15;
const PROJECTILE_RADIUS = 3;
const STARTING_LIVES = 20;
const STARTING_MONEY = 100;
const WAVE_START_MONEY = 25;

// --- Game State ---
let lives = STARTING_LIVES;
let money = STARTING_MONEY;
let wave = 0;
let balloons = [];
let towers = [];
let projectiles = [];
let waveInProgress = false;
let balloonsToSpawn = 0;
let spawnCounter = 0;
let spawnInterval = 90;
let gameOver = false;
let currentMousePos = { x: 0, y: 0 };
let placingTower = true;
let waveBalloonTypes = [];
let waveSpawnIndex = 0;

// --- Theme Colors (will be updated from CSS) ---
let themeColors = {
    path: '#a0522d',
    tower: 'blue',
    projectile: 'black',
    balloonRed: 'red',
    balloonBlue: 'blue',
    balloonGreen: 'green',
    balloonYellow: '#CCCC00',
    balloonStroke: 'black',
    indicatorValid: 'rgba(0, 255, 0, 0.7)',
    indicatorInvalid: 'rgba(255, 0, 0, 0.7)'
};

// --- Path Definition ---
const path = [
    { x: 0, y: canvas.height / 2 },
    { x: canvas.width / 2, y: canvas.height / 2 },
    { x: canvas.width / 2, y: canvas.height },
];

// Update tower cost display
towerCostEl.textContent = TOWER_COST;

// --- Helper Function to Get Theme Colors ---
function updateThemeColors() {
    const computedStyle = getComputedStyle(document.documentElement); // Or document.body if class is on body
    themeColors.path = computedStyle.getPropertyValue('--path-color').trim();
    themeColors.tower = computedStyle.getPropertyValue('--js-tower-color').trim();
    themeColors.projectile = computedStyle.getPropertyValue('--js-projectile-color').trim();
    themeColors.balloonRed = computedStyle.getPropertyValue('--js-balloon-red').trim();
    themeColors.balloonBlue = computedStyle.getPropertyValue('--js-balloon-blue').trim();
    themeColors.balloonGreen = computedStyle.getPropertyValue('--js-balloon-green').trim();
    themeColors.balloonYellow = computedStyle.getPropertyValue('--js-balloon-yellow').trim();
    themeColors.balloonStroke = computedStyle.getPropertyValue('--js-balloon-stroke').trim();
    themeColors.indicatorValid = computedStyle.getPropertyValue('--indicator-valid').trim();
    themeColors.indicatorInvalid = computedStyle.getPropertyValue('--indicator-invalid').trim();
    console.log("Theme colors updated:", themeColors); // For debugging
}


// --- Classes (with updated draw methods) ---
class Balloon {
    constructor(health = 1, speed = BASE_BALLOON_SPEED, value = 1) {
        this.x = path[0].x - BALLOON_RADIUS;
        this.y = path[0].y;
        this.radius = BALLOON_RADIUS;
        this.maxHealth = health;
        this.health = health;
        this.speed = speed;
        this.pathIndex = 0;
        this.distanceTraveled = 0;
        this.value = value;
        this.popped = false;
    }

    move() {
        if (this.pathIndex >= path.length - 1 && !this.popped) {
            lives--;
            if (lives <= 0) { gameOver = true; lives = 0; }
            this.popped = true; this.health = 0; updateUI(); return;
        }
        if (this.popped) return;

        const targetPoint = path[this.pathIndex + 1];
        const dx = targetPoint.x - this.x;
        const dy = targetPoint.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.speed) {
            this.x = targetPoint.x; this.y = targetPoint.y;
            this.pathIndex++; this.distanceTraveled += distance;
        } else {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
            this.distanceTraveled += this.speed;
        }
    }

    draw() {
        if (this.popped && this.health <= 0) return;

        // Use theme colors for balloons
        if (this.health > 3) { ctx.fillStyle = themeColors.balloonYellow; }
        else if (this.health > 2) { ctx.fillStyle = themeColors.balloonGreen; }
        else if (this.health > 1) { ctx.fillStyle = themeColors.balloonBlue; }
        else { ctx.fillStyle = themeColors.balloonRed; }

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = themeColors.balloonStroke; // Use theme stroke color
        ctx.stroke();
    }

    takeDamage(amount) {
        if (this.popped) return;
        this.health -= amount;
        if (this.health <= 0) {
            money += this.value;
            this.popped = true;
            updateUI();
        }
    }
}

class Tower {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = TOWER_RADIUS; this.range = TOWER_RANGE;
        this.fireRate = TOWER_FIRE_RATE; this.fireCooldown = 0;
        this.damage = PROJECTILE_DAMAGE;
    }

    findTarget() {
        let bestTarget = null; let maxDistance = -1;
        for (const balloon of balloons) {
            if (balloon.popped) continue;
            const dx = balloon.x - this.x; const dy = balloon.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= this.range) {
                if (balloon.distanceTraveled > maxDistance) {
                    maxDistance = balloon.distanceTraveled; bestTarget = balloon;
                }
            }
        }
        return bestTarget;
    }

    shoot(target) {
        if (this.fireCooldown <= 0 && target) {
            projectiles.push(new Projectile(this.x, this.y, target, this.damage));
            this.fireCooldown = this.fireRate;
        }
    }
    updateCooldown() { if (this.fireCooldown > 0) { this.fireCooldown--; } }

    draw() {
        ctx.fillStyle = themeColors.tower; // Use theme color for tower
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    }
}

class Projectile {
    constructor(x, y, targetBalloon, damage) {
        this.x = x; this.y = y;
        this.target = targetBalloon; this.damage = damage;
        this.speed = PROJECTILE_SPEED; this.radius = PROJECTILE_RADIUS;
        const dx = this.target.x - this.x; const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        this.vx = (dx / distance) * this.speed; this.vy = (dy / distance) * this.speed;
    }

    move() { this.x += this.vx; this.y += this.vy; }

    checkHit() {
        if (!this.target || this.target.popped) return false;
        const dx = this.target.x - this.x; const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.target.radius + this.radius;
    }

    draw() {
        ctx.fillStyle = themeColors.projectile; // Use theme color for projectile
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    isOutOfBounds() { return this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height; }
}

// --- Game Functions (drawPath and updatePlacementIndicator updated) ---
function updateUI() { /* ... (no changes needed) ... */
    livesEl.textContent = lives;
    moneyEl.textContent = money;
    waveEl.textContent = wave;
}

function drawPath() {
    ctx.strokeStyle = themeColors.path; // Use theme color for path
    ctx.lineWidth = TILE_SIZE * 0.8;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) { ctx.lineTo(path[i].x, path[i].y); }
    ctx.stroke();
    ctx.lineWidth = 1;
}

function defineWaveBalloons() { /* ... (no changes needed) ... */
    waveBalloonTypes = []; waveSpawnIndex = 0;
    const numBalloons = wave * 5 + 10;
    let health = 1;
    let speed = Math.min(BASE_BALLOON_SPEED * 2.5, BASE_BALLOON_SPEED + (wave - 1) * 0.05);
    let value = 1;
    if (wave >= 15) { health = 4; value = 4; }
    else if (wave >= 10) { health = 3; value = 3; }
    else if (wave >= 5) { health = 2; value = 2; }
    for (let i = 0; i < numBalloons; i++) {
        waveBalloonTypes.push({ health: health, speed: speed, value: value });
    }
    balloonsToSpawn = waveBalloonTypes.length;
}

function spawnBalloon() { /* ... (no changes needed) ... */
    if (waveSpawnIndex < waveBalloonTypes.length && spawnCounter <= 0) {
        const balloonConfig = waveBalloonTypes[waveSpawnIndex];
        balloons.push(new Balloon(balloonConfig.health, balloonConfig.speed, balloonConfig.value));
        waveSpawnIndex++; balloonsToSpawn--;
        spawnCounter = spawnInterval;
    }
    if (spawnCounter > 0) { spawnCounter--; }
}

function startNextWave() { /* ... (no changes needed) ... */
    if (waveInProgress || gameOver) return;
    wave++;
    money += WAVE_START_MONEY + Math.floor(wave / 2.0);
    defineWaveBalloons();
    spawnCounter = 0;
    spawnInterval = Math.max(15, 90 - wave * 2);
    waveInProgress = true;
    startWaveBtn.disabled = true;
    updateUI();
}

function isPositionOnPath(x, y, margin = TILE_SIZE * 0.6) { /* ... (no changes needed) ... */
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i]; const p2 = path[i + 1];
        const minX = Math.min(p1.x, p2.x) - margin; const maxX = Math.max(p1.x, p2.x) + margin;
        const minY = Math.min(p1.y, p2.y) - margin; const maxY = Math.max(p1.y, p2.y) + margin;
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            const dx = p2.x - p1.x; const dy = p2.y - p1.y; const lenSq = dx * dx + dy * dy;
            if (lenSq === 0) { const distSq = (x - p1.x) * (x - p1.x) + (y - p1.y) * (y - p1.y); if (distSq <= margin * margin) return true; continue; }
            let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq; t = Math.max(0, Math.min(1, t));
            const closestX = p1.x + t * dx; const closestY = p1.y + t * dy;
            const distSq = (x - closestX) * (x - closestX) + (y - closestY) * (y - closestY);
            if (distSq <= margin * margin) return true;
        }
    } return false;
}

function placeTower(event) { /* ... (no changes needed) ... */
    if (gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left; const mouseY = event.clientY - rect.top;
    if (money >= TOWER_COST) {
        if (!isPositionOnPath(mouseX, mouseY)) {
            t
