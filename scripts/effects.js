// Effect System for Fantasy RTS
// Handles visual effects like projectiles, magic, blood, etc.

import * as THREE from 'three';

export class EffectManager {
    constructor(scene) {
        this.scene = scene;
        this.activeEffects = [];
    }

    /**
     * Spawn a new effect
     * @param {string} type - Effect type ('arrow', 'lightning', 'blood', 'fireball', 'heal')
     * @param {object} params - Parameters for the effect
     */
    spawnEffect(type, params) {
        let effect = null;
        switch (type) {
            case 'arrow':
                effect = new ArrowEffect(this.scene, params);
                break;
            case 'lightning':
                effect = new LightningEffect(this.scene, params);
                break;
            case 'blood':
                effect = new BloodEffect(this.scene, params);
                break;
            case 'fireball':
                effect = new FireballEffect(this.scene, params);
                break;
            case 'heal':
                effect = new HealEffect(this.scene, params);
                break;
            default:
                console.warn(`[EffectManager] Unknown effect type: ${type}`);
                return;
        }

        if (effect) {
            this.activeEffects.push(effect);
        }
    }

    /**
     * Update all active effects
     * @param {number} deltaTime - Time elapsed since last frame in milliseconds
     */
    update(deltaTime) {
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            effect.update(deltaTime);
            if (effect.isFinished) {
                effect.cleanup();
                this.activeEffects.splice(i, 1);
            }
        }
    }
}

// Base Effect Class
export class Effect {
    constructor(scene) {
        this.scene = scene;
        this.isFinished = false;
        this.age = 0;
        this.meshes = [];
    }

    update(deltaTime) {
        this.age += deltaTime;
    }

    cleanup() {
        this.meshes.forEach(mesh => {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
            this.scene.remove(mesh);
        });
        this.meshes = [];
    }
}

// --------------------------------------------------------
// Specific Effects
// --------------------------------------------------------

class LightningEffect extends Effect {
    constructor(scene, { startPos, endPos }) {
        super(scene);

        // Ensure positions are Vector3
        this.startPos = startPos instanceof THREE.Vector3 ? startPos : new THREE.Vector3(startPos.x, startPos.y, startPos.z);
        this.endPos = endPos instanceof THREE.Vector3 ? endPos : new THREE.Vector3(endPos.x, endPos.y, endPos.z);

        // Sky position (directly above target for better visual)
        const skyHeight = 200;
        this.skyPos = new THREE.Vector3(this.endPos.x, this.endPos.y + skyHeight, this.endPos.z);
        this.boltLength = skyHeight;

        this.createMeshes();

        // Timing
        this.flashDuration = 100;
        this.sustainDuration = 200;
        this.fadeDuration = 300;
        this.totalDuration = this.flashDuration + this.sustainDuration + this.fadeDuration;

        // Audio
        if (window.game && window.game.audioEngine) {
            if (window.game.audioEngine.sfxThunder) window.game.audioEngine.sfxThunder();
            else if (window.game.audioEngine.sfxHit) window.game.audioEngine.sfxHit();
        }

        // Screen Flash
        this.triggerScreenFlash(0xaa88ff, 50);
    }

    triggerScreenFlash(color = 0xffffff, duration = 100) {
        const flash = document.getElementById('flash-overlay');
        if (flash) {
            const colorHex = '#' + color.toString(16).padStart(6, '0');
            flash.style.backgroundColor = colorHex;
            flash.style.opacity = 0.3;
            setTimeout(() => {
                flash.style.opacity = 0;
                flash.style.backgroundColor = 'white';
            }, duration);
        }
    }

    createMeshes() {
        this.group = new THREE.Group();
        this.meshes.push(this.group);
        this.scene.add(this.group);

        // Main bolt
        const boltGeo = new THREE.CylinderGeometry(0.5, 1.2, this.boltLength, 4);
        const boltMat = new THREE.MeshBasicMaterial({
            color: 0xaa88ff,
            transparent: true,
            opacity: 0.9
        });
        this.bolt = new THREE.Mesh(boltGeo, boltMat);
        this.bolt.position.set(this.skyPos.x, this.skyPos.y - this.boltLength / 2, this.skyPos.z);
        this.group.add(this.bolt);

        // Core
        const coreGeo = new THREE.CylinderGeometry(0.2, 0.5, this.boltLength, 4);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0
        });
        this.core = new THREE.Mesh(coreGeo, coreMat);
        this.core.position.copy(this.bolt.position);
        this.group.add(this.core);

        // Impact
        const impactGeo = new THREE.SphereGeometry(6, 8, 8);
        const impactMat = new THREE.MeshBasicMaterial({
            color: 0xaa88ff,
            transparent: true,
            opacity: 0.8
        });
        this.impact = new THREE.Mesh(impactGeo, impactMat);
        this.impact.position.copy(this.endPos);
        this.group.add(this.impact);
    }

    update(deltaTime) {
        super.update(deltaTime);

        if (this.age >= this.totalDuration) {
            this.isFinished = true;
            return;
        }

        if (this.age < this.flashDuration) {
            // Flicker
            const flicker = Math.random() > 0.5 ? 1 : 0.3;
            this.bolt.material.opacity = flicker * 0.9;
            this.core.material.opacity = flicker;
        } else if (this.age < this.flashDuration + this.sustainDuration) {
            // Sustain
            this.bolt.material.opacity = 0.8;
            this.core.material.opacity = 1;
        } else {
            // Fade
            const fadeProgress = (this.age - this.flashDuration - this.sustainDuration) / this.fadeDuration;
            this.bolt.material.opacity = 0.8 * (1 - fadeProgress);
            this.core.material.opacity = 1 - fadeProgress;
            this.impact.material.opacity = 0.8 * (1 - fadeProgress);
            this.impact.scale.setScalar(1 + fadeProgress * 2);
        }
    }
}

class ArrowEffect extends Effect {
    constructor(scene, { startPos, endPos }) {
        super(scene);
        this.startPos = startPos.clone();
        this.endPos = endPos.clone();

        // Audio
        // if (window.game && window.game.audioEngine && window.game.audioEngine.sfxShoot) {
        //     window.game.audioEngine.sfxShoot(); // Audio is triggered by unit animation usually, but could be here
        // }

        this.dist = this.startPos.distanceTo(this.endPos);
        this.duration = Math.min(1000, Math.max(500, this.dist * 10)); // Speed based on distance
        // Close range: high arc to clear units (e.g. 100 - dist*0.2). Far range: lower arc.
        this.peakHeight = Math.max(30, 120 - this.dist * 0.3);

        this.createMesh();
    }

    createMesh() {
        const group = new THREE.Group();
        this.meshes.push(group);
        this.scene.add(group);
        this.arrowGroup = group;

        // Shaft - thin wooden arrow shaft
        const shaftGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.5, 6);
        const shaftMat = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        shaft.rotation.x = -Math.PI / 2;
        shaft.position.z = 0;
        group.add(shaft);

        // Arrowhead - small silver tip
        const headGeo = new THREE.ConeGeometry(0.15, 0.6, 4);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xAAAAAA });
        const head = new THREE.Mesh(headGeo, headMat);
        head.rotation.x = -Math.PI / 2;
        head.position.z = 2.05;
        group.add(head);

        // Fletching - 3 small red feathers at 120 degree intervals
        const featherGeo = new THREE.PlaneGeometry(0.4, 0.8);
        const featherMat = new THREE.MeshBasicMaterial({
            color: 0xCC2222,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        for (let i = 0; i < 3; i++) {
            const feather = new THREE.Mesh(featherGeo, featherMat);
            feather.position.z = -1.5;
            feather.rotation.z = (Math.PI * 2 / 3) * i;
            group.add(feather);
        }

        group.scale.set(0.8, 0.8, 0.8);
        group.position.copy(this.startPos);
        group.lookAt(this.endPos);
    }

    update(deltaTime) {
        super.update(deltaTime);

        const t = this.age / this.duration;

        if (t >= 1.0) {
            this.isFinished = true;
            // Impact Sound
            if (window.game && window.game.audioEngine && window.game.audioEngine.sfxHit) {
                window.game.audioEngine.sfxHit();
            }
            return;
        }

        // Parabolic flight
        const midX = (this.startPos.x + this.endPos.x) / 2;
        const midZ = (this.startPos.z + this.endPos.z) / 2;
        const midY = (this.startPos.y + this.endPos.y) / 2 + this.peakHeight;
        const controlPos = new THREE.Vector3(midX, midY, midZ);

        const invT = 1 - t;
        const posX = invT * invT * this.startPos.x + 2 * invT * t * controlPos.x + t * t * this.endPos.x;
        const posY = invT * invT * this.startPos.y + 2 * invT * t * controlPos.y + t * t * this.endPos.y;
        const posZ = invT * invT * this.startPos.z + 2 * invT * t * controlPos.z + t * t * this.endPos.z;

        // Look ahead for smooth rotation
        const nextT = Math.min(1.0, t + 0.05);
        const nextInvT = 1 - nextT;
        const nextX = nextInvT * nextInvT * this.startPos.x + 2 * nextInvT * nextT * controlPos.x + nextT * nextT * this.endPos.x;
        const nextY = nextInvT * nextInvT * this.startPos.y + 2 * nextInvT * nextT * controlPos.y + nextT * nextT * this.endPos.y;
        const nextZ = nextInvT * nextInvT * this.startPos.z + 2 * nextInvT * nextT * controlPos.z + nextT * nextT * this.endPos.z;

        this.arrowGroup.position.set(posX, posY, posZ);
        this.arrowGroup.lookAt(nextX, nextY, nextZ);
    }
}

class BloodEffect extends Effect {
    constructor(scene, { position }) {
        super(scene);
        this.position = position.clone();
        this.duration = 500;

        this.particles = [];
        this.particleCount = 8;

        const material = new THREE.MeshBasicMaterial({ color: 0xcc0000 });
        const geometry = new THREE.BoxGeometry(2, 2, 2);

        for (let i = 0; i < this.particleCount; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(this.position);
            mesh.position.x += (Math.random() - 0.5) * 5;
            mesh.position.y += (Math.random() - 0.5) * 5 + 10;
            mesh.position.z += (Math.random() - 0.5) * 5;

            // Random velocity
            mesh.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 10 + 5,
                (Math.random() - 0.5) * 10
            );

            this.scene.add(mesh);
            this.meshes.push(mesh);
            this.particles.push(mesh);
        }
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (this.age > this.duration) {
            this.isFinished = true;
            return;
        }

        const gravity = -30; // Gravity scale
        const dtSec = deltaTime / 1000;

        this.particles.forEach(p => {
            p.userData.velocity.y += gravity * dtSec;
            p.position.addScaledVector(p.userData.velocity, dtSec);
            p.rotation.x += p.userData.velocity.z * 0.1;
            p.rotation.y += p.userData.velocity.x * 0.1;

            // ground check (approximate)
            if (p.position.y < this.position.y - 5) {
                p.position.y = this.position.y - 5;
                p.userData.velocity.set(0, 0, 0);
            }
        });
    }
}

class FireballEffect extends Effect {
    constructor(scene, { startPos, endPos }) {
        super(scene);
        this.startPos = startPos.clone();
        this.endPos = endPos.clone();
        this.currentPos = this.startPos.clone();

        this.speed = 150; // Units per second
        this.dist = this.startPos.distanceTo(this.endPos);
        this.duration = (this.dist / this.speed) * 1000;

        this.exploded = false;
        this.explosionDuration = 400;

        this.createProjectile();
    }

    createProjectile() {
        const group = new THREE.Group();
        this.meshes.push(group);
        this.scene.add(group);
        this.projectileGroup = group;

        // Core
        const coreGeo = new THREE.SphereGeometry(3, 8, 8);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        this.core = new THREE.Mesh(coreGeo, coreMat);
        group.add(this.core);

        // Trail (simplified as a tail)
        const tailGeo = new THREE.ConeGeometry(2, 8, 8);
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 });
        this.tail = new THREE.Mesh(tailGeo, tailMat);
        this.tail.rotation.x = Math.PI / 2; // Point backward
        this.tail.position.z = -4;
        group.add(this.tail);

        group.position.copy(this.startPos);
        group.lookAt(this.endPos);
    }

    createExplosion() {
        // Hide projectile
        this.projectileGroup.visible = false;

        // Create explosion particles
        const particleCount = 10;
        const material = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const geometry = new THREE.BoxGeometry(3, 3, 3);

        for (let i = 0; i < particleCount; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(this.endPos);
            mesh.userData.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            );
            this.scene.add(mesh);
            this.meshes.push(mesh); // Add to meshes for cleanup
        }
    }

    update(deltaTime) {
        super.update(deltaTime);

        if (!this.exploded) {
            // Projectile Phase
            const t = this.age / this.duration;
            if (t >= 1.0) {
                this.exploded = true;
                this.explosionTime = 0;
                this.createExplosion();
                return;
            }

            this.currentPos.lerpVectors(this.startPos, this.endPos, t);
            this.projectileGroup.position.copy(this.currentPos);
            // Rotate core slightly
            this.core.rotation.z += 0.2;
        } else {
            // Explosion Phase
            this.explosionTime += deltaTime;
            if (this.explosionTime > this.explosionDuration) {
                this.isFinished = true;
                return;
            }

            // Expand active particles (the ones added after project group)
            // Note: meshes[0] is projectile group
            for (let i = 1; i < this.meshes.length; i++) {
                const p = this.meshes[i];
                const dtSec = deltaTime / 1000;
                p.position.addScaledVector(p.userData.velocity, dtSec);
                p.scale.multiplyScalar(0.95); // Shrink
            }
        }
    }
}

class HealEffect extends Effect {
    constructor(scene, { targetPos }) {
        super(scene);
        this.position = targetPos.clone();
        this.duration = 1500;

        // Sound
        if (window.game && window.game.audioEngine && window.game.audioEngine.sfxBuff) {
            // Assuming sfxBuff exists, otherwise use a fallback or add it later
            window.game.audioEngine.sfxBuff();
        }

        this.createVeil();
        this.createParticles();
    }

    createVeil() {
        this.veilGroup = new THREE.Group();
        this.scene.add(this.veilGroup);
        this.meshes.push(this.veilGroup);

        // Cylinder (Veil)
        // Top radius slightly smaller than bottom for a "beam" look
        const geo = new THREE.CylinderGeometry(10, 12, 40, 16, 1, true);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffaa, // Brighter Warm light
            transparent: true,
            opacity: 0.5, // Higher base opacity
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.veil = new THREE.Mesh(geo, mat);

        // Start high
        this.veilStartPosition = this.position.clone().add(new THREE.Vector3(0, 40, 0));
        this.veilEndPosition = this.position.clone().add(new THREE.Vector3(0, 5, 0));

        this.veil.position.copy(this.veilStartPosition);
        this.veilGroup.add(this.veil);

        // Inner core (brighter)
        const coreGeo = new THREE.CylinderGeometry(4, 4, 40, 8, 1, true);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xffd700, // Gold
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.core = new THREE.Mesh(coreGeo, coreMat);
        this.core.position.copy(this.veil.position);
        this.veilGroup.add(this.core);
    }

    createParticles() {
        this.particles = [];
        const count = 15;
        const geo = new THREE.PlaneGeometry(2, 2);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffd700,
            side: THREE.DoubleSide,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(geo, mat);
            // Random position inside veil area
            const r = 8 * Math.sqrt(Math.random());
            const theta = Math.random() * 2 * Math.PI;
            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);

            // Random height start
            const y = 30 + Math.random() * 20;

            mesh.position.set(this.position.x + x, this.position.y + y, this.position.z + z);

            mesh.userData.speed = 20 + Math.random() * 20;
            mesh.userData.wobble = Math.random() * Math.PI * 2;

            // Random rotation
            mesh.rotation.z = Math.random() * Math.PI;

            this.scene.add(mesh);
            this.meshes.push(mesh);
            this.particles.push(mesh);

            // Start invisible
            mesh.material.opacity = 0;
        }
    }

    update(deltaTime) {
        super.update(deltaTime);
        if (this.age > this.duration) {
            this.isFinished = true;
            return;
        }

        const t = this.age / this.duration; // 0 to 1
        const dtSec = deltaTime / 1000;

        // Veil Animation: Descend and Fade
        // Phase 1: Descend (0.0 - 0.5)
        // Phase 2: Fade Out (0.5 - 1.0)

        // Position
        if (t < 0.6) {
            const ease = 1 - Math.pow(1 - (t / 0.6), 2); // Ease out
            this.veil.position.lerpVectors(this.veilStartPosition, this.veilEndPosition, ease);
            this.core.position.copy(this.veil.position);
        }

        // Opacity
        // Fade in quickly, hold, then fade out
        let opacity = 0;
        if (t < 0.2) {
            opacity = t / 0.2;
        } else if (t < 0.6) {
            opacity = 1.0;
        } else {
            opacity = 1.0 - ((t - 0.6) / 0.4);
        }

        this.veil.material.opacity = opacity * 0.4;
        this.core.material.opacity = opacity * 0.6;

        // Rotate veil slightly
        this.veil.rotation.y += 0.5 * dtSec;
        this.core.rotation.y -= 1.0 * dtSec;

        // Particles Animation (Falling down like light dust)
        this.particles.forEach(p => {
            // Activate opacity
            if (t < 0.2) p.material.opacity = t / 0.2;
            else if (t > 0.7) p.material.opacity = (1 - t) / 0.3;

            p.position.y -= p.userData.speed * dtSec;
            p.rotation.y += 2 * dtSec;
            p.rotation.x += 1 * dtSec;

            // Check ground
            if (p.position.y < this.position.y) {
                p.position.y = this.position.y;
            }
        });
    }
}
