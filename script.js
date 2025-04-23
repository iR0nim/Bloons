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


// --- Path Definition (Simple L-shape) ---
const path = [
    { x: 0, y: canvas.height / 2 },
    { x: canvas.width / 2, y: canvas.height / 2 },
    { x: canvas.width / 2, y: canvas.height },
];

// Update tower cost display
towerCostEl.textContent = TOWER_COST;

// --- Classes ---
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

        // Change color based on current
