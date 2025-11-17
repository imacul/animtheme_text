import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- SETUP -----------------------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 150);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- PARTICLE SETUP --------------------------------------------------------------
const PARTICLE_COUNT = 15000;
const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(PARTICLE_COUNT * 3);
const colors = new Float32Array(PARTICLE_COUNT * 3);
const sizes = new Float32Array(PARTICLE_COUNT);

// These arrays will store the start and end states for our animation
const initialPositions = new Float32Array(PARTICLE_COUNT * 3);
const targetPositions = new Float32Array(PARTICLE_COUNT * 3);

const colorPalette = [
    new THREE.Color(0x87CEEB), // SkyBlue
    new THREE.Color(0xFF69B4), // HotPink
    new THREE.Color(0x9370DB)  // MediumPurple
];

for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    
    // Initial random position in a sphere
    const radius = Math.random() * 150;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    initialPositions[i3] = x;
    initialPositions[i3 + 1] = y;
    initialPositions[i3 + 2] = z;

    // Assign a random color
    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    sizes[i] = Math.random() * 1.5 + 0.5;
}

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

const material = new THREE.PointsMaterial({
    size: 0.5,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false, // Important for blending
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// --- TEXT SAMPLING ---------------------------------------------------------------
// This function gets the 3D coordinates from text
function sampleTextToPoints(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = 'bold 100px Arial';
    ctx.font = font;
    const textMetrics = ctx.measureText(text);
    canvas.width = Math.ceil(textMetrics.width);
    canvas.height = 120;

    // Redraw text now that canvas is sized
    ctx.font = font;
    ctx.fillStyle = '#fff';
    ctx.fillText(text, 0, 100);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const points = [];
    for (let y = 0; y < imageData.height; y++) {
        for (let x = 0; x < imageData.width; x++) {
            const alpha = imageData.data[(y * imageData.width + x) * 4 + 3];
            if (alpha > 128) {
                points.push({
                    x: x - canvas.width / 2, // Center the text
                    y: -(y - canvas.height / 2),
                });
            }
        }
    }
    return points;
}

const textPoints = sampleTextToPoints('AnimTheme');

// Distribute the text points among our particles
for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    const point = textPoints[i % textPoints.length]; // Loop through text points
    targetPositions[i3] = point.x;
    targetPositions[i3 + 1] = point.y;
    targetPositions[i3 + 2] = (Math.random() - 0.5) * 10; // Give it some depth
}

// --- INTERACTION & ANIMATION -----------------------------------------------------
const mouse = new THREE.Vector2();
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

const clock = new THREE.Clock();
let animationProgress = 0;

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Animate the transition from sphere to text
    animationProgress = Math.sin(elapsedTime * 0.2) * 0.5 + 0.5; // Smoothly oscillate between 0 and 1

    const currentPositions = particles.geometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        // LERP: Interpolate between initial and target positions
        const ix = initialPositions[i3];
        const iy = initialPositions[i3 + 1];
        const iz = initialPositions[i3 + 2];
        const tx = targetPositions[i3];
        const ty = targetPositions[i3 + 1];
        const tz = targetPositions[i3 + 2];

        currentPositions[i3] = THREE.MathUtils.lerp(ix, tx, animationProgress);
        currentPositions[i3 + 1] = THREE.MathUtils.lerp(iy, ty, animationProgress);
        currentPositions[i3 + 2] = THREE.MathUtils.lerp(iz, tz, animationProgress);
        
        // --- MOUSE INTERACTION (DISRUPTION) ---
        const particlePos = new THREE.Vector3(currentPositions[i3], currentPositions[i3 + 1], currentPositions[i3 + 2]);
        const mouse3D = new THREE.Vector3(mouse.x * 100, mouse.y * 100, 0);
        const distance = particlePos.distanceTo(mouse3D);
        const maxDistance = 40;
        
        if (distance < maxDistance) {
            const disruptionForce = (1 - (distance / maxDistance)) * 15;
            const disruptionVector = particlePos.clone().sub(mouse3D).normalize().multiplyScalar(disruptionForce);
            currentPositions[i3] += disruptionVector.x;
            currentPositions[i3 + 1] += disruptionVector.y;
            currentPositions[i3 + 2] += disruptionVector.z;
        }
    }
    
    particles.geometry.attributes.position.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);
}

animate();

// --- RESIZE HANDLER --------------------------------------------------------------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});