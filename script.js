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
const TILE_SIZE = 40; // Grid size for path/placement (visual aid)
const TOWER_COST = 50;
const TOWER_RANGE = 120;
const TOWER_FIRE_RATE = 60; // Frames between shots (lower is faster)
const PROJECTILE_SPEED = 6;
const PROJECTILE_DAMAGE = 1;
const BALLOON_SPEED = 1;
const BALLOON_HEALTH = 1;
const BALLOON_RADIUS = 15;
const TOWER_RADIUS = 15;
const PROJECTILE_RADIUS = 3;
const STARTING_LIVES = 20;
const STARTING_MONEY = 100;
const WAVE_START_MONEY = 25; // Money earned at start of each wave

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
let spawnInterval = 90; // Frames between balloon spawns
let gameOver = false;
let currentMousePos = { x: 0, y: 0 };
let placingTower = true; // By default, clicking places a tower

// --- Path Definition (Simple L-shape) ---
// Coordinates are approximate centers for balloons
const path = [
    { x: 0, y: canvas.height / 2 },
    { x: canvas.width / 2, y: canvas.height / 2 },
    { x: canvas.width / 2, y: canvas.height },
    // Add more points for a complex path
];

// Update tower cost display
towerCostEl.textContent = TOWER_COST;

// --- Classes ---
class Balloon {
    constructor() {
        this.x = path[0].x - BALLOON_RADIUS; // Start slightly off-screen
        this.y = path[0].y;
        this.radius = BALLOON_RADIUS;
        this.health = BALLOON_HEALTH;
        this.speed = BALLOON_SPEED;
        this.pathIndex = 0; // Current target point index
        this.distanceTraveled = 0; // For tower targeting priority
        this.value = 1; // Money awarded
    }

    move() {
        if (this.pathIndex >= path.length - 1) {
            // Reached end
            lives--;
            if (lives <= 0) {
                gameOver = true;
                lives = 0; // Prevent negative lives display
            }
            this.health = 0; // Mark for removal
            updateUI();
            return;
        }

        const targetPoint = path[this.pathIndex + 1];
        const dx = targetPoint.x - this.x;
        const dy = targetPoint.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.speed) {
            // Reached the point, move to next
            this.x = targetPoint.x;
            this.y = targetPoint.y;
            this.pathIndex++;
            this.distanceTraveled += distance; // Add remaining distance
        } else {
            // Move towards the point
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
            this.distanceTraveled += this.speed;
        }
    }

    draw() {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.stroke();
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            money += this.value;
            updateUI();
        }
    }
}

class Tower {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = TOWER_RADIUS;
        this.range = TOWER_RANGE;
        this.fireRate = TOWER_FIRE_RATE;
        this.fireCooldown = 0; // Time until next shot
        this.damage = PROJECTILE_DAMAGE;
    }

    findTarget() {
        let bestTarget = null;
        let maxDistance = -1;

        for (const balloon of balloons) {
            if (balloon.health <= 0) continue; // Skip already popped

            const dx = balloon.x - this.x;
            const dy = balloon.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= this.range) {
                // Prioritize balloon furthest along the path
                if (balloon.distanceTraveled > maxDistance) {
                    maxDistance = balloon.distanceTraveled;
                    bestTarget = balloon;
                }
            }
        }
        return bestTarget;
    }

    shoot(target) {
        if (this.fireCooldown <= 0 && target) {
            projectiles.push(new Projectile(this.x, this.y, target, this.damage));
            this.fireCooldown = this.fireRate; // Reset cooldown
        }
    }

    updateCooldown() {
        if (this.fireCooldown > 0) {
            this.fireCooldown--;
        }
    }

    draw() {
        // Simple tower representation (e.g., a blue square)
        ctx.fillStyle = 'blue';
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);

        // Draw range indicator (optional, only when placing or selected)
        // For simplicity, we won't draw it constantly in this version
    }
}

class Projectile {
    constructor(x, y, target, damage) {
        this.x = x;
        this.y = y;
        this.target = target; // Reference to the balloon
        this.damage = damage;
        this.speed = PROJECTILE_SPEED;
        this.radius = PROJECTILE_RADIUS;

        // Calculate initial direction (doesn't home in this simple version)
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        this.vx = (dx / distance) * this.speed;
        this.vy = (dy / distance) * this.speed;
    }

    move() {
        this.x += this.vx;
        this.y += this.vy;
    }

    checkHit() {
        if (this.target.health <= 0) return false; // Target already gone

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance < this.target.radius + this.radius;
    }

    draw() {
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    isOutOfBounds() {
        return this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height;
    }
}

// --- Game Functions ---
function updateUI() {
    livesEl.textContent = lives;
    moneyEl.textContent = money;
    waveEl.textContent = wave;
}

function drawPath() {
    ctx.strokeStyle = '#a0522d'; // Brownish path color
    ctx.lineWidth = TILE_SIZE * 0.8; // Path width
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
    ctx.lineWidth = 1; // Reset line width
}

function spawnBalloon() {
    if (balloonsToSpawn > 0 && spawnCounter <= 0) {
        balloons.push(new Balloon());
        balloonsToSpawn--;
        spawnCounter = spawnInterval; // Reset spawn timer
    }
    if (spawnCounter > 0) {
        spawnCounter--;
    }
}

function startNextWave() {
    if (waveInProgress || gameOver) return;

    wave++;
    money += WAVE_START_MONEY; // Give some money at wave start
    balloonsToSpawn = wave * 5 + 10; // Increase balloons per wave
    spawnCounter = 0; // Start spawning immediately
    spawnInterval = Math.max(15, 90 - wave * 3); // Balloons spawn faster in later waves
    waveInProgress = true;
    startWaveBtn.disabled = true;
    updateUI();
}

function isPositionOnPath(x, y, margin = TILE_SIZE * 0.6) {
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];

        // Check bounding box first for quick rejection
        const minX = Math.min(p1.x, p2.x) - margin;
        const maxX = Math.max(p1.x, p2.x) + margin;
        const minY = Math.min(p1.y, p2.y) - margin;
        const maxY = Math.max(p1.y, p2.y) + margin;

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            // Check distance to the line segment
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;

            // Handle zero-length segment case (shouldn't happen with distinct path points)
            if (lenSq === 0) {
                 const distSq = (x - p1.x) * (x - p1.x) + (y - p1.y) * (y - p1.y);
                 if (distSq <= margin * margin) return true;
                 continue;
            }

            // Parameter t represents the projection of (x,y) onto the line
            let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t)); // Clamp t to the segment

            const closestX = p1.x + t * dx;
            const closestY = p1.y + t * dy;
            const distSq = (x - closestX) * (x - closestX) + (y - closestY) * (y - closestY);

            if (distSq <= margin * margin) {
                return true; // Too close to this path segment
            }
        }
    }
    return false; // Not close to any path segment
}


function placeTower(event) {
    if (gameOver) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (money >= TOWER_COST) {
        // Check if placement is valid (not on path)
        if (!isPositionOnPath(mouseX, mouseY)) {
             // Optional: Check proximity to other towers if needed
            towers.push(new Tower(mouseX, mouseY));
            money -= TOWER_COST;
            updateUI();
        } else {
            console.log("Cannot place tower on path!");
            // Add visual feedback maybe?
        }
    } else {
        console.log("Not enough money!");
         // Add visual feedback maybe?
    }
}

function updatePlacementIndicator() {
    if (gameOver || !placingTower) {
        placementIndicator.style.display = 'none';
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const indicatorSize = TOWER_RANGE * 2;
    const indicatorX = currentMousePos.x - TOWER_RANGE + rect.left + window.scrollX;
    const indicatorY = currentMousePos.y - TOWER_RANGE + rect.top + window.scrollY;

    placementIndicator.style.left = `${indicatorX}px`;
    placementIndicator.style.top = `${indicatorY}px`;
    placementIndicator.style.width = `${indicatorSize}px`;
    placementIndicator.style.height = `${indicatorSize}px`;

    if (money >= TOWER_COST && !isPositionOnPath(currentMousePos.x, currentMousePos.y)) {
         placementIndicator.style.borderColor = 'rgba(0, 255, 0, 0.7)'; // Green = valid
         placementIndicator.style.display = 'block';
         canvas.style.cursor = 'crosshair';
    } else {
         placementIndicator.style.borderColor = 'rgba(255, 0, 0, 0.7)'; // Red = invalid
         placementIndicator.style.display = 'block';
          canvas.style.cursor = 'not-allowed';
    }
}


// --- Game Loop ---
function gameLoop() {
    if (gameOver) {
        gameOverEl.style.display = 'block';
        placementIndicator.style.display = 'none'; // Hide indicator on game over
        canvas.style.cursor = 'default';
        return; // Stop the loop
    }

    // --- Update ---
    // Spawn new balloons if wave is active
    if (waveInProgress) {
        spawnBalloon();
    }

    // Update Balloons
    for (let i = balloons.length - 1; i >= 0; i--) {
        balloons[i].move();
        if (balloons[i].health <= 0) {
            balloons.splice(i, 1); // Remove popped or finished balloons
        }
    }

    // Update Towers
    for (const tower of towers) {
        tower.updateCooldown();
        const target = tower.findTarget();
        if (target) {
            tower.shoot(target);
        }
    }

    // Update Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        projectiles[i].move();
        let hit = false;
        // Check collision only if target still exists (basic check)
         if (projectiles[i].target && projectiles[i].target.health > 0 && projectiles[i].checkHit()) {
            projectiles[i].target.takeDamage(projectiles[i].damage);
            hit = true;
        }

        if (hit || projectiles[i].isOutOfBounds()) {
            projectiles.splice(i, 1);
        }
    }

     // Check if wave is over
     if (waveInProgress && balloons.length === 0 && balloonsToSpawn === 0) {
         waveInProgress = false;
         startWaveBtn.disabled = false;
         // Optional: Add end-of-wave bonus money
     }


    // --- Draw ---
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Path
    drawPath();

    // Draw Towers
    towers.forEach(tower => tower.draw());

    // Draw Balloons
    balloons.forEach(balloon => balloon.draw());

    // Draw Projectiles
    projectiles.forEach(projectile => projectile.draw());

    // Draw Placement Indicator Range (handled by CSS/DOM now)
    updatePlacementIndicator();


    // Request next frame
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
startWaveBtn.addEventListener('click', startNextWave);
canvas.addEventListener('click', placeTower);

// Track mouse for placement indicator
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    currentMousePos.x = event.clientX - rect.left;
    currentMousePos.y = event.clientY - rect.top;
});

canvas.addEventListener('mouseleave', () => {
     placementIndicator.style.display = 'none'; // Hide when mouse leaves canvas
      canvas.style.cursor = 'default';
});
canvas.addEventListener('mouseenter', () => {
    if (placingTower && !gameOver) {
        placementIndicator.style.display = 'block'; // Show when mouse enters if placing
    }
});


// --- Initial Setup ---
updateUI();
requestAnimationFrame(gameLoop); // Start the game loop!