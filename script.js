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
const TILE_SIZE = 40;
const TOWER_COST = 50;
const TOWER_RANGE = 120;
const TOWER_FIRE_RATE = 60; // Frames between shots (lower is faster)
const PROJECTILE_SPEED = 6;
const PROJECTILE_DAMAGE = 1;
const BASE_BALLOON_SPEED = 1; // Renamed for clarity
const BALLOON_RADIUS = 15;
const TOWER_RADIUS = 15;
const PROJECTILE_RADIUS = 3;
const STARTING_LIVES = 20;
const STARTING_MONEY = 100;
const WAVE_START_MONEY = 25; // Base money earned at start of each wave

// --- Game State ---
let lives = STARTING_LIVES;
let money = STARTING_MONEY;
let wave = 0;
let balloons = [];
let towers = [];
let projectiles = [];
let waveInProgress = false;
let balloonsToSpawn = 0; // Tracks remaining balloons for wave end check
let spawnCounter = 0;   // Cooldown timer for spawning individual balloons
let spawnInterval = 90; // Default frames between balloon spawns
let gameOver = false;
let currentMousePos = { x: 0, y: 0 };
let placingTower = true; // By default, clicking places a tower

// State for controlling balloon types per wave
let waveBalloonTypes = []; // Array to hold balloon configurations for the current wave
let waveSpawnIndex = 0;   // Index for spawning from waveBalloonTypes


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

// --- Path Definition (Simple L-shape) ---
const path = [
    { x: 0, y: canvas.height / 2 },
    { x: canvas.width / 2, y: canvas.height / 2 },
    { x: canvas.width / 2, y: canvas.height },
];

// Update tower cost display
towerCostEl.textContent = TOWER_COST;

// --- Helper Function to Get Theme Colors ---
function updateThemeColors() {
    // Ensure this runs after the DOM is fully loaded and CSS applied
    try {
        const computedStyle = getComputedStyle(document.documentElement);
        themeColors.path = computedStyle.getPropertyValue('--path-color').trim() || themeColors.path;
        themeColors.tower = computedStyle.getPropertyValue('--js-tower-color').trim() || themeColors.tower;
        themeColors.projectile = computedStyle.getPropertyValue('--js-projectile-color').trim() || themeColors.projectile;
        themeColors.balloonRed = computedStyle.getPropertyValue('--js-balloon-red').trim() || themeColors.balloonRed;
        themeColors.balloonBlue = computedStyle.getPropertyValue('--js-balloon-blue').trim() || themeColors.balloonBlue;
        themeColors.balloonGreen = computedStyle.getPropertyValue('--js-balloon-green').trim() || themeColors.balloonGreen;
        themeColors.balloonYellow = computedStyle.getPropertyValue('--js-balloon-yellow').trim() || themeColors.balloonYellow;
        themeColors.balloonStroke = computedStyle.getPropertyValue('--js-balloon-stroke').trim() || themeColors.balloonStroke;
        themeColors.indicatorValid = computedStyle.getPropertyValue('--indicator-valid').trim() || themeColors.indicatorValid;
        themeColors.indicatorInvalid = computedStyle.getPropertyValue('--indicator-invalid').trim() || themeColors.indicatorInvalid;
        // console.log("Theme colors updated:", themeColors); // For debugging
    } catch (error) {
        console.error("Error updating theme colors:", error);
        // Keep default colors if CSS variables fail
    }
}


// --- Classes (with updated draw methods) ---
class Balloon {
    // Constructor now accepts health, speed, and value based on wave difficulty
    constructor(health = 1, speed = BASE_BALLOON_SPEED, value = 1) {
        this.x = path[0].x - BALLOON_RADIUS; // Start slightly off-screen
        this.y = path[0].y;
        this.radius = BALLOON_RADIUS;
        this.maxHealth = health; // Store max health for drawing/logic
        this.health = health;    // Current health
        this.speed = speed;      // Use passed speed
        this.pathIndex = 0; // Current target point index
        this.distanceTraveled = 0; // For tower targeting priority
        this.value = value;      // Money awarded
        this.popped = false;     // Flag to ensure money/lives only processed once
    }

    move() {
        // Check if reached end and hasn't been processed yet
        if (this.pathIndex >= path.length - 1 && !this.popped) {
            lives--;
            if (lives <= 0) {
                gameOver = true;
                lives = 0; // Prevent negative lives display
            }
            this.popped = true; // Mark as processed (reached end)
            this.health = 0;    // Mark for removal from game logic perspective
            updateUI();
            return; // Stop moving
        }
         // Don't move if already processed (popped or reached end)
        if (this.popped) return;

        // --- Standard Movement Logic ---
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
         // Don't draw if effectively removed (popped and health gone)
        if (this.popped && this.health <= 0) return;

        // Change color based on current health
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
        if (this.popped) return; // Can't damage processed balloons

        this.health -= amount;
        if (this.health <= 0) {
            money += this.value;
            this.popped = true; // Mark as popped (will be removed by game loop)
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
             // Skip balloons that have been popped or reached the end
            if (balloon.popped) continue;

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
             // Pass the actual balloon object as the target
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
        ctx.fillStyle = themeColors.tower; // Use theme color for tower
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    }
}

class Projectile {
    constructor(x, y, targetBalloon, damage) { // Target is the balloon object
        this.x = x;
        this.y = y;
        this.target = targetBalloon; // Store reference to the balloon object
        this.damage = damage;
        this.speed = PROJECTILE_SPEED;
        this.radius = PROJECTILE_RADIUS;

        // Calculate initial direction towards target's current position
        // This version does NOT home in - it fires straight
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1; // Avoid division by zero
        this.vx = (dx / distance) * this.speed;
        this.vy = (dy / distance) * this.speed;
    }

    move() {
        this.x += this.vx;
        this.y += this.vy;
    }

    // Check collision against the stored target balloon object
    checkHit() {
        // Check if the target balloon still exists and hasn't been popped
        if (!this.target || this.target.popped) {
            return false;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Collision if distance is less than sum of radii
        return distance < this.target.radius + this.radius;
    }

    draw() {
        ctx.fillStyle = themeColors.projectile; // Use theme color for projectile
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
    ctx.strokeStyle = themeColors.path; // Use theme color for path
    ctx.lineWidth = TILE_SIZE * 0.8; // Path width
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
    ctx.lineWidth = 1; // Reset line width
}

// Define the types and sequence of balloons for the upcoming wave
function defineWaveBalloons() {
    waveBalloonTypes = []; // Clear previous wave types
    waveSpawnIndex = 0;    // Reset spawn index for the new wave

    const numBalloons = wave * 5 + 10; // Base number of balloons for the wave
    let health = 1;
    // Increase base speed slightly each wave, capping it eventually
    let speed = Math.min(BASE_BALLOON_SPEED * 2.5, BASE_BALLOON_SPEED + (wave - 1) * 0.05);
    let value = 1;

    // Determine primary balloon type based on wave number
    if (wave >= 15) {
        health = 4; value = 4; // Example: Yellow
    } else if (wave >= 10) {
        health = 3; value = 3; // Green
    } else if (wave >= 5) {
        health = 2; value = 2; // Blue
    } // Default: Red (health=1, value=1)

     // Create the list of balloons to spawn for this wave
     // Simple approach: All balloons in the wave are the same determined type
    for (let i = 0; i < numBalloons; i++) {
        // Future enhancement: Could push different types here for mixed waves
        waveBalloonTypes.push({ health: health, speed: speed, value: value });
    }

    balloonsToSpawn = waveBalloonTypes.length; // Set total count for wave end check
}

// Spawns the next balloon based on the wave definition
function spawnBalloon() {
    // Check if wave definition has balloons left and spawn cooldown is ready
    if (waveSpawnIndex < waveBalloonTypes.length && spawnCounter <= 0) {
        const balloonConfig = waveBalloonTypes[waveSpawnIndex];
        // Create balloon with properties defined for this wave
        balloons.push(new Balloon(balloonConfig.health, balloonConfig.speed, balloonConfig.value));

        waveSpawnIndex++;      // Move to the next balloon in the definition
        // balloonsToSpawn--; // This counter is now just for the initial wave definition
        spawnCounter = spawnInterval; // Reset spawn timer
    }

    // Decrement spawn timer if active
    if (spawnCounter > 0) {
        spawnCounter--;
    }
}

function startNextWave() {
    if (waveInProgress || gameOver) return;

    wave++;
    // Give slightly more money in later waves
    money += WAVE_START_MONEY + Math.floor(wave / 2.0);
    defineWaveBalloons(); // Set up the balloon types/stats for this wave

    spawnCounter = 0; // Reset counter to start spawning immediately
    // Decrease spawn interval faster in later waves, minimum 15 frames
    spawnInterval = Math.max(15, 90 - wave * 2);
    waveInProgress = true;
    startWaveBtn.disabled = true; // Disable button during wave
    updateUI();
}


function isPositionOnPath(x, y, margin = TILE_SIZE * 0.6) {
    for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i];
        const p2 = path[i + 1];

        const minX = Math.min(p1.x, p2.x) - margin;
        const maxX = Math.max(p1.x, p2.x) + margin;
        const minY = Math.min(p1.y, p2.y) - margin;
        const maxY = Math.max(p1.y, p2.y) + margin;

        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq === 0) {
                 const distSq = (x - p1.x) * (x - p1.x) + (y - p1.y) * (y - p1.y);
                 if (distSq <= margin * margin) return true;
                 continue;
            }
            let t = ((x - p1.x) * dx + (y - p1.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            const closestX = p1.x + t * dx;
            const closestY = p1.y + t * dy;
            const distSq = (x - closestX) * (x - closestX) + (y - closestY) * (y - closestY);
            if (distSq <= margin * margin) return true;
        }
    }
    return false;
}


function placeTower(event) {
    if (gameOver) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (money >= TOWER_COST) {
        if (!isPositionOnPath(mouseX, mouseY)) {
            towers.push(new Tower(mouseX, mouseY));
            money -= TOWER_COST;
            updateUI();
        } else {
            console.log("Cannot place tower on path!");
        }
    } else {
        console.log("Not enough money!");
    }
}

function updatePlacementIndicator() {
    if (gameOver || !placingTower) {
        placementIndicator.style.display = 'none';
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const indicatorSize = TOWER_RANGE * 2;
    // Adjust position based on canvas position and scroll offset
    const indicatorX = currentMousePos.x - TOWER_RANGE + rect.left + window.scrollX;
    const indicatorY = currentMousePos.y - TOWER_RANGE + rect.top + window.scrollY;

    placementIndicator.style.left = `${indicatorX}px`;
    placementIndicator.style.top = `${indicatorY}px`;
    placementIndicator.style.width = `${indicatorSize}px`;
    placementIndicator.style.height = `${indicatorSize}px`;

    // Determine validity based on money and path proximity
    // Use theme colors for indicator border
    if (money >= TOWER_COST && !isPositionOnPath(currentMousePos.x, currentMousePos.y)) {
         placementIndicator.style.borderColor = themeColors.indicatorValid; // Use theme color
         placementIndicator.style.display = 'block';
         canvas.style.cursor = 'crosshair';
    } else {
         placementIndicator.style.borderColor = themeColors.indicatorInvalid; // Use theme color
         placementIndicator.style.display = 'block';
          canvas.style.cursor = 'not-allowed';
    }
}


// --- Game Loop ---
function gameLoop() {
    if (gameOver) {
        gameOverEl.style.display = 'block';
        placementIndicator.style.display = 'none';
        canvas.style.cursor = 'default';
        // No further updates or drawing needed if game is over
        return;
    }

    // --- Update ---
    // Spawn new balloons if wave is active
    if (waveInProgress) {
        spawnBalloon();
    }

    // Update Balloons - Move first, then check for removal
    for (let i = balloons.length - 1; i >= 0; i--) {
        balloons[i].move(); // Attempt to move all balloons

        // Check if balloon should be removed (popped AND health gone)
        // Note: Balloons that reach the end set popped=true and health=0 in move()
        if (balloons[i].popped && balloons[i].health <= 0) {
             balloons.splice(i, 1);
        }
    }


    // Update Towers
    for (const tower of towers) {
        tower.updateCooldown();
        const target = tower.findTarget(); // Find target only once per frame
        if (target) { // Only attempt to shoot if a valid target is found
            tower.shoot(target);
        }
    }

    // Update Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        projectiles[i].move();
        let hit = false;
        // Check collision - also checks if target is valid inside checkHit()
         if (projectiles[i].checkHit()) {
            // Apply damage via the target reference stored in the projectile
            projectiles[i].target.takeDamage(projectiles[i].damage);
            hit = true; // Mark projectile for removal after hitting
        }

        // Remove projectile if it hit something or went off-screen
        if (hit || projectiles[i].isOutOfBounds()) {
            projectiles.splice(i, 1);
        }
    }

     // Check if wave is over: Needs all defined balloons to be spawned AND no balloons left on screen
     if (waveInProgress && balloons.length === 0 && waveSpawnIndex === waveBalloonTypes.length) {
         waveInProgress = false;
         startWaveBtn.disabled = false; // Re-enable button for next wave
     }


    // --- Draw ---
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas
    drawPath();                                         // Draw the track
    towers.forEach(tower => tower.draw());              // Draw towers
    balloons.forEach(balloon => balloon.draw());        // Draw remaining balloons
    projectiles.forEach(projectile => projectile.draw());// Draw projectiles
    updatePlacementIndicator();                         // Update tower placement preview

    // Request next frame
    requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
startWaveBtn.addEventListener('click', startNextWave);
canvas.addEventListener('click', placeTower);
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    currentMousePos.x = event.clientX - rect.left;
    currentMousePos.y = event.clientY - rect.top;
});
canvas.addEventListener('mouseleave', () => {
     placementIndicator.style.display = 'none';
     canvas.style.cursor = 'default';
});
canvas.addEventListener('mouseenter', () => {
    if (placingTower && !gameOver) {
        placementIndicator.style.display = 'block';
    }
});


// --- Initial Setup ---
// Wait for the DOM and CSS to be fully loaded before applying styles/starting game
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('dark-mode'); // Apply dark mode class
    updateThemeColors(); // Read initial theme colors from CSS
    updateUI(); // Set initial UI values (lives, money, etc.)
    requestAnimationFrame(gameLoop); // Start the game loop!
});
