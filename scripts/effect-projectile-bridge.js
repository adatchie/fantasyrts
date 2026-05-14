import * as THREE from 'three';

export class EffectProjectileBridge {
    constructor(renderingEngine) {
        this.renderingEngine = renderingEngine;
    }

    getActionSpeedMultiplier() {
        return (window.game && window.game.actionSpeed && window.game.actionSpeed > 0.1)
            ? window.game.actionSpeed
            : 1.0;
    }

    resolveExternalHeight(unit) {
        if (!this.renderingEngine?.externalHeightProvider) {
            return 0;
        }

        const cacheKey = `${unit.x},${unit.y}`;
        if (!this.renderingEngine.buildingHeightCache) {
            this.renderingEngine.buildingHeightCache = new Map();
        }
        if (!this.renderingEngine.buildingHeightCache.has(cacheKey)) {
            this.renderingEngine.buildingHeightCache.set(
                cacheKey,
                this.renderingEngine.externalHeightProvider(unit.x, unit.y)
            );
        }
        return this.renderingEngine.buildingHeightCache.get(cacheKey) || 0;
    }

    resolveHexHeight(unit) {
        if (!this.renderingEngine?.hexHeights?.[unit.y]) {
            return 0;
        }
        return this.renderingEngine.hexHeights[unit.y][unit.x] || 0;
    }

    resolveMapBuildingHeight(unit) {
        if (!this.renderingEngine?.mapSystem?.getBuildingHeight) {
            return 0;
        }
        return this.renderingEngine.mapSystem.getBuildingHeight(unit.x, unit.y) || 0;
    }

    resolveWorldPoint(unit, options = {}) {
        const {
            baseHeightSource = 'hexOrExternal',
            yOffset = 0
        } = options;

        const world = this.renderingEngine.gridToWorld3D(unit.x, unit.y);
        let baseHeight = 0;

        if (baseHeightSource === 'hexOrExternal') {
            const hexHeight = this.resolveHexHeight(unit);
            const externalHeight = this.resolveExternalHeight(unit);
            baseHeight = externalHeight > 0 ? externalHeight : hexHeight;
        } else if (baseHeightSource === 'unitZOrMapBuilding') {
            const tileHeight = (unit.z || 0) * 16;
            const buildingHeight = this.resolveMapBuildingHeight(unit);
            baseHeight = buildingHeight > 0 ? buildingHeight : tileHeight;
        }

        return {
            x: world.x,
            y: baseHeight + yOffset,
            z: world.z
        };
    }

    buildArrowTrajectoryConfig(fromUnit, toUnit, blockInfo) {
        const startPoint = this.resolveWorldPoint(fromUnit, {
            baseHeightSource: 'hexOrExternal',
            yOffset: 12
        });
        const endPoint = this.resolveWorldPoint(toUnit, {
            baseHeightSource: 'hexOrExternal',
            yOffset: 12
        });

        const fullStartVec = this.toVector3(startPoint);
        const fullEndVec = this.toVector3(endPoint);
        const fullDistance = fullStartVec.distanceTo(fullEndVec);
        const speedMultiplier = this.getActionSpeedMultiplier();
        const duration = Math.max(400, Math.min(1000, fullDistance * 8)) / speedMultiplier;
        const arcHeight = (blockInfo && blockInfo.arcHeight !== undefined)
            ? blockInfo.arcHeight
            : 20 + fullDistance * 2;
        const limitT = (blockInfo && blockInfo.blocked && blockInfo.t) ? blockInfo.t : 1.0;

        return {
            startPoint,
            endPoint,
            fullStartVec,
            fullEndVec,
            fullDistance,
            duration,
            arcHeight,
            limitT
        };
    }

    buildMagicProjectileConfig(fromUnit, toUnit, color = 0xAA00FF) {
        const startPoint = this.resolveWorldPoint(fromUnit, {
            baseHeightSource: 'unitZOrMapBuilding',
            yOffset: 16
        });
        const endPoint = this.resolveWorldPoint(toUnit, {
            baseHeightSource: 'unitZOrMapBuilding',
            yOffset: 16
        });

        return {
            startPoint,
            endPoint,
            startPos: this.toVector3(startPoint),
            endPos3D: this.toVector3(endPoint),
            color
        };
    }

    toVector3(point) {
        return new THREE.Vector3(point.x, point.y, point.z);
    }

    async playArrowProjectile(fromUnit, toUnit, blockInfo) {
        if (!this.renderingEngine?.spawnArrowAnimation) {
            return false;
        }

        await this.renderingEngine.spawnArrowAnimation(fromUnit, toUnit, blockInfo);
        return true;
    }

    async playMagicProjectile(fromUnit, toUnit, color = 0xAA00FF) {
        if (!this.renderingEngine?.spawnMagicProjectile) {
            return false;
        }

        await this.renderingEngine.spawnMagicProjectile(fromUnit, toUnit, color);
        return true;
    }
}
