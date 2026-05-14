import * as THREE from 'three';
import { EffectManager as LegacyEffectManager } from './effects.js?v=123';
import { EFFECT_DEFINITIONS } from './effect-definitions.js?v=1';

const MANAGED_SOURCE_TAG = 'effect-manager-v2';
const NORMALIZER_REQUIRED_CONTEXT_KEYS = Object.freeze({
    FLOAT_TEXT: ['sourceHex', 'text'],
    SPARK: ['midHex'],
    DUST: ['sourceHex'],
    BEAM: ['sourceHex', 'targetHex'],
    SLASH: ['sourceHex', 'targetHex'],
    THUNDER_TILE: ['sourceHex'],
    WAVE: ['sourceHex', 'targetHex'],
    HEX_FLASH: ['sourceHex'],
    UNIT_FLASH: ['unitId'],
    MAGIC_CAST: ['sourceEntity'],
    BREATH: ['sourceEntity', 'targetEntity'],
    BUBBLE: ['sourceEntity', 'text']
});

function isDevelopmentHost() {
    if (typeof window === 'undefined') {
        return false;
    }

    const hostname = window.location?.hostname ?? '';
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
}

export class EffectManagerV2 {
    constructor(renderingEngine) {
        this.renderingEngine = renderingEngine;
        this.scene = renderingEngine?.scene ?? null;
        this.activeEffects = [];
        this.legacyEffectManager = this.scene ? new LegacyEffectManager(this.scene) : null;
        this.effectDefinitions = EFFECT_DEFINITIONS;
    }

    playEffect(effectId, context = {}) {
        const definition = this.effectDefinitions[effectId];
        if (!definition) {
            console.warn(`[EffectManagerV2] Unsupported effect id: ${effectId}`);
            return false;
        }

        const normalized = this.normalizeContext(context);
        this.validateNormalizerRequirements(effectId, definition, normalized);
        this.validateContextKeys(effectId, definition, normalized);
        const effectRecord = {
            id: effectId,
            definition,
            context: normalized,
            startedAt: performance.now()
        };

        const handled = this.spawnFromDefinition(definition, normalized);

        if (handled) {
            this.activeEffects.push(effectRecord);
        }
        return handled;
    }

    isStrictValidationEnabled() {
        if (!isDevelopmentHost()) {
            return false;
        }

        return window.__EFFECT_VALIDATION_STRICT__ === true;
    }

    reportValidationIssue(level, message, meta = {}) {
        if (level === 'strict' && this.isStrictValidationEnabled()) {
            console.error(message, meta);
            if (typeof window.__showStrictValidationMessage === 'function') {
                window.__showStrictValidationMessage(message);
            }
            if (console.trace) {
                console.trace('[EffectManagerV2] strict validation trace');
            }
            return;
        }

        console.warn(message, meta);
    }

    validateNormalizerRequirements(effectId, definition, context) {
        const requiredKeys = NORMALIZER_REQUIRED_CONTEXT_KEYS[definition.normalizerKey];
        if (!Array.isArray(requiredKeys) || requiredKeys.length === 0) {
            return;
        }

        const missingKeys = requiredKeys.filter(key => {
            const value = context[key];
            return value === null || value === undefined;
        });

        if (missingKeys.length > 0) {
            this.reportValidationIssue(
                'strict',
                `[EffectManagerV2] Normalizer "${definition.normalizerKey}" for "${effectId}" is missing required keys: ${missingKeys.join(', ')}`,
                { effectId, normalizerKey: definition.normalizerKey, missingKeys, context }
            );
        }
    }

    validateContextKeys(effectId, definition, context) {
        if (!Array.isArray(definition.contextKeys) || definition.contextKeys.length === 0) {
            return;
        }

        const missingKeys = definition.contextKeys.filter(key => {
            const value = context[key];
            return value === null || value === undefined;
        });

        if (missingKeys.length > 0) {
            this.reportValidationIssue(
                'strict',
                `[EffectManagerV2] Context for "${effectId}" is missing expected keys: ${missingKeys.join(', ')}`,
                { effectId, contextKeys: definition.contextKeys, missingKeys, context }
            );
        }
    }

    update(deltaMs) {
        if (this.legacyEffectManager) {
            this.legacyEffectManager.update(deltaMs);
        }

        if (!this.renderingEngine) {
            this.activeEffects.length = 0;
            return;
        }

        this.activeEffects = this.activeEffects.filter(effect => {
            if (effect.id === 'blood_small' || effect.id === 'heal_pulse') {
                return this.legacyEffectManager?.activeEffects?.length > 0;
            }
            return this.renderingEngine.hasManagedEffects?.(MANAGED_SOURCE_TAG) ?? false;
        });
    }

    clearAll() {
        if (this.legacyEffectManager) {
            for (const effect of this.legacyEffectManager.activeEffects) {
                effect.cleanup();
            }
            this.legacyEffectManager.activeEffects.length = 0;
        }

        if (this.renderingEngine?.clearManagedEffects) {
            this.renderingEngine.clearManagedEffects(MANAGED_SOURCE_TAG);
        }

        this.activeEffects.length = 0;
    }

    normalizeContext(context = {}) {
        const sourceEntity = context.sourceEntity
            ?? context.sourceUnit
            ?? context.source
            ?? context.unit
            ?? null;
        const targetEntity = context.targetEntity
            ?? context.targetUnit
            ?? context.target
            ?? null;
        const sourceHex = this.resolveHex(
            context.sourceHex
            ?? context.sourcePos
            ?? sourceEntity
            ?? context
        );
        const targetHex = this.resolveHex(
            context.targetHex
            ?? context.targetPos
            ?? targetEntity
        );
        const midHex = sourceHex && targetHex
            ? {
                q: (sourceHex.q + targetHex.q) / 2,
                r: (sourceHex.r + targetHex.r) / 2
            }
            : (sourceHex ?? targetHex ?? null);

        return {
            sourceEntity,
            targetEntity,
            sourceHex,
            targetHex,
            midHex,
            sourceWorld: this.resolveWorld(sourceHex),
            targetWorld: this.resolveWorld(targetHex),
            midWorld: this.resolveWorld(midHex),
            text: context.text ?? null,
            color: context.color ?? null,
            size: context.size ?? null,
            unitId: context.unitId ?? sourceEntity?.id ?? null,
            duration: context.duration ?? null
        };
    }

    resolveHex(candidate) {
        if (!candidate) return null;

        const q = candidate.q ?? candidate.x;
        const r = candidate.r ?? candidate.y;
        if (typeof q !== 'number' || typeof r !== 'number') {
            return null;
        }

        return { q, r };
    }

    resolveWorld(hex) {
        if (!hex || !this.renderingEngine?.hexToWorld3D) {
            return null;
        }

        if (this.renderingEngine?.hexToWorld3DWithHeight) {
            const world = this.renderingEngine.hexToWorld3DWithHeight(hex.q, hex.r);
            return world?.clone ? world.clone() : new THREE.Vector3(world.x, world.y, world.z);
        }

        const world = this.renderingEngine.hexToWorld3D(hex.q, hex.r);
        return world?.clone ? world.clone() : new THREE.Vector3(world.x, world.y, world.z);
    }

    spawnManaged3DEffect(type, hex) {
        if (!hex || !this.renderingEngine?.addManaged3DEffect) {
            return false;
        }

        this.renderingEngine.addManaged3DEffect(MANAGED_SOURCE_TAG, type, hex);
        return true;
    }

    spawnManaged3DEffectArgs(type, args = []) {
        if (!this.renderingEngine?.addManaged3DEffect) {
            return false;
        }

        if (!Array.isArray(args) || args.length === 0 || args[0] == null) {
            return false;
        }

        this.renderingEngine.addManaged3DEffect(MANAGED_SOURCE_TAG, type, ...args);
        return true;
    }

    spawnLegacyEffect(type, params) {
        if (!this.legacyEffectManager) {
            return false;
        }

        this.legacyEffectManager.spawnEffect(type, params);
        return true;
    }

    spawnFromDefinition(definition, context) {
        if (definition.transport === 'managed3d') {
            if (definition.buildArgs) {
                return this.spawnManaged3DEffectArgs(
                    definition.factoryKey ?? definition.rendererType,
                    definition.buildArgs(context)
                );
            }

            return this.spawnManaged3DEffect(
                definition.factoryKey ?? definition.rendererType,
                this.resolveAnchorHex(definition.anchor, context)
            );
        }

        if (definition.transport === 'legacy') {
            const params = definition.buildParams ? definition.buildParams(context) : {};
            return this.spawnLegacyEffect(definition.legacyType, params);
        }

        console.warn(`[EffectManagerV2] Unknown transport: ${definition.transport}`);
        return false;
    }

    resolveAnchorHex(anchor, context) {
        switch (anchor) {
            case 'source':
                return context.sourceHex;
            case 'target':
                return context.targetHex;
            case 'mid':
            default:
                return context.midHex;
        }
    }
}

export { MANAGED_SOURCE_TAG as EFFECT_MANAGER_V2_SOURCE_TAG };
