const EFFECT_DEFINITION_SCHEMA_VERSION = 1;
const CONE_STREAM_SCHEMA_VERSION = 1;

function toUnitRef(entity, hex) {
    if (entity) return entity;
    if (!hex) return null;
    return { x: hex.q, y: hex.r };
}

function defineManaged3DEffect(id, rendererType, buildArgs, options = {}) {
    return {
        id,
        schemaVersion: EFFECT_DEFINITION_SCHEMA_VERSION,
        transport: 'managed3d',
        category: options.category ?? 'default',
        rendererType,
        normalizerKey: options.normalizerKey ?? rendererType,
        factoryKey: options.factoryKey ?? rendererType,
        lifecycle: options.lifecycle ?? 'rendering3d',
        contextKeys: options.contextKeys ?? [],
        coneStream: options.coneStream ?? null,
        buildArgs
    };
}

function defineManagedConeStreamEffect(id, rendererType, buildArgs, options = {}) {
    return defineManaged3DEffect(id, rendererType, buildArgs, {
        ...options,
        category: 'cone_stream',
        coneStream: {
            schemaVersion: CONE_STREAM_SCHEMA_VERSION,
            mode: options.coneStream?.mode ?? 'cone',
            attachTo: options.coneStream?.attachTo ?? 'sourceEntity',
            aimAt: options.coneStream?.aimAt ?? 'targetEntity',
            length: options.coneStream?.length ?? 96,
            spreadDeg: options.coneStream?.spreadDeg ?? 30,
            lifetimeMs: options.coneStream?.lifetimeMs ?? 220,
            fadeOutMs: options.coneStream?.fadeOutMs ?? 120,
            flicker: options.coneStream?.flicker ?? false
        }
    });
}

function defineLegacyEffect(id, legacyType, buildParams, options = {}) {
    return {
        id,
        schemaVersion: EFFECT_DEFINITION_SCHEMA_VERSION,
        transport: 'legacy',
        legacyType,
        normalizerKey: options.normalizerKey ?? null,
        factoryKey: options.factoryKey ?? legacyType,
        lifecycle: options.lifecycle ?? 'legacy-effect-manager',
        contextKeys: options.contextKeys ?? [],
        buildParams
    };
}

const RAW_EFFECT_DEFINITIONS = {
    hit_spark: defineManaged3DEffect(
        'hit_spark',
        'SPARK',
        (context) => [context.midHex],
        { contextKeys: ['sourceHex', 'targetHex'] }
    ),
    dust_step: defineManaged3DEffect(
        'dust_step',
        'DUST',
        (context) => [context.sourceHex],
        { contextKeys: ['sourceHex'] }
    ),
    float_text: defineManaged3DEffect(
        'float_text',
        'FLOAT_TEXT',
        (context) => [{
            q: context.sourceHex?.q,
            r: context.sourceHex?.r,
            text: context.text,
            color: context.color,
            size: context.size
        }],
        { contextKeys: ['sourceHex', 'text', 'color', 'size'] }
    ),
    blood_small: defineLegacyEffect(
        'blood_small',
        'blood',
        (context) => ({
            position: context.midWorld
        }),
        { contextKeys: ['sourceHex', 'targetHex'] }
    ),
    heal_pulse: defineLegacyEffect(
        'heal_pulse',
        'heal',
        (context) => ({
            targetPos: context.targetWorld ?? context.sourceWorld
        }),
        { contextKeys: ['sourceHex', 'targetHex'] }
    ),
    attack_beam: defineManaged3DEffect(
        'attack_beam',
        'BEAM',
        (context) => [context.sourceHex, context.targetHex, context.color ?? '#ffaa00'],
        { contextKeys: ['sourceHex', 'targetHex', 'color'] }
    ),
    attack_slash: defineManaged3DEffect(
        'attack_slash',
        'SLASH',
        (context) => [{
            start: context.sourceHex,
            end: context.targetHex,
            color: context.color ?? '#ffffff',
            variant: 'basic'
        }],
        { contextKeys: ['sourceHex', 'targetHex', 'color'] }
    ),
    attack_slash_special: defineManaged3DEffect(
        'attack_slash_special',
        'SLASH',
        (context) => [{
            start: context.sourceHex,
            end: context.targetHex,
            color: context.color ?? '#ffffff',
            variant: 'special'
        }],
        { contextKeys: ['sourceHex', 'targetHex', 'color'] }
    ),
    magic_impact_thunder: defineManaged3DEffect(
        'magic_impact_thunder',
        'THUNDER_TILE',
        (context) => [{
            q: context.targetHex?.q ?? context.sourceHex?.q,
            r: context.targetHex?.r ?? context.sourceHex?.r,
            color: context.color ?? 0x66ccff
        }],
        { contextKeys: ['targetHex', 'color'] }
    ),
    attack_wave: defineManaged3DEffect(
        'attack_wave',
        'WAVE',
        (context) => [context.sourceHex, context.targetHex],
        { contextKeys: ['sourceHex', 'targetHex'] }
    ),
    hex_flash: defineManaged3DEffect(
        'hex_flash',
        'HEX_FLASH',
        (context) => [{
            q: context.sourceHex?.q,
            r: context.sourceHex?.r,
            color: context.color
        }],
        { contextKeys: ['sourceHex', 'color'] }
    ),
    unit_flash: defineManaged3DEffect(
        'unit_flash',
        'UNIT_FLASH',
        (context) => [{
            unitId: context.unitId,
            color: context.color,
            duration: context.duration
        }],
        { contextKeys: ['unitId', 'color', 'duration'] }
    ),
    magic_cast: defineManaged3DEffect(
        'magic_cast',
        'MAGIC_CAST',
        (context) => [toUnitRef(context.sourceEntity, context.sourceHex)],
        { contextKeys: ['sourceEntity'] }
    ),
    breath_attack: defineManagedConeStreamEffect(
        'breath_attack',
        'BREATH',
        (context) => [{
            att: toUnitRef(context.sourceEntity, context.sourceHex),
            def: toUnitRef(context.targetEntity, context.targetHex),
            coneStream: {
                life: 30,
                maxLife: 30,
                opacity: 0.6,
                length: 96,
                spreadDeg: 32,
                lifetimeMs: 220,
                fadeOutMs: 120,
                flicker: true
            }
        }],
        {
            contextKeys: ['sourceEntity', 'targetEntity'],
            coneStream: {
                mode: 'cone',
                attachTo: 'sourceEntity',
                aimAt: 'targetEntity',
                length: 96,
                spreadDeg: 32,
                lifetimeMs: 220,
                fadeOutMs: 120,
                flicker: true
            }
        }
    ),
    flame_stream_attack: defineManagedConeStreamEffect(
        'flame_stream_attack',
        'BREATH',
        (context) => [{
            att: toUnitRef(context.sourceEntity, context.sourceHex),
            def: toUnitRef(context.targetEntity, context.targetHex),
            coneStream: {
                mode: 'stream',
                life: 36,
                maxLife: 36,
                opacity: 0.52,
                length: 88,
                spreadDeg: 18,
                lifetimeMs: 260,
                fadeOutMs: 140,
                flicker: true
            }
        }],
        {
            contextKeys: ['sourceEntity', 'targetEntity'],
            coneStream: {
                mode: 'stream',
                attachTo: 'sourceEntity',
                aimAt: 'targetEntity',
                length: 88,
                spreadDeg: 18,
                lifetimeMs: 260,
                fadeOutMs: 140,
                flicker: true
            }
        }
    ),
    speech_bubble: defineManaged3DEffect(
        'speech_bubble',
        'BUBBLE',
        (context) => [{
            unit: toUnitRef(context.sourceEntity, context.sourceHex),
            text: context.text
        }],
        { contextKeys: ['sourceEntity', 'text'] }
    )
};

const MANAGED_CONE_STREAM_SCHEMA_TEMPLATE = Object.freeze(defineManagedConeStreamEffect(
    '__template__',
    'BREATH',
    () => [],
    {
        normalizerKey: 'BREATH',
        factoryKey: 'BREATH',
        contextKeys: ['sourceEntity', 'targetEntity'],
        coneStream: {
            mode: 'cone',
            attachTo: 'sourceEntity',
            aimAt: 'targetEntity',
            length: 96,
            spreadDeg: 30,
            lifetimeMs: 220,
            fadeOutMs: 120,
            flicker: true
        }
    }
));

function validateEffectDefinition(id, definition) {
    const errors = [];

    if (!definition || typeof definition !== 'object') {
        errors.push('definition must be an object');
        return errors;
    }
    if (definition.id !== id) {
        errors.push(`id mismatch: expected "${id}", got "${definition.id}"`);
    }
    if (definition.schemaVersion !== EFFECT_DEFINITION_SCHEMA_VERSION) {
        errors.push(`unsupported schemaVersion: ${definition.schemaVersion}`);
    }
    if (definition.transport !== 'managed3d' && definition.transport !== 'legacy') {
        errors.push(`unsupported transport: ${definition.transport}`);
    }
    if (definition.transport === 'managed3d') {
        if (typeof definition.rendererType !== 'string' || definition.rendererType.length === 0) {
            errors.push('managed3d definition requires rendererType');
        }
        if (typeof definition.normalizerKey !== 'string' || definition.normalizerKey.length === 0) {
            errors.push('managed3d definition requires normalizerKey');
        }
        if (typeof definition.factoryKey !== 'string' || definition.factoryKey.length === 0) {
            errors.push('managed3d definition requires factoryKey');
        }
        if (typeof definition.buildArgs !== 'function') {
            errors.push('managed3d definition requires buildArgs(context)');
        }
        if (definition.category !== undefined && typeof definition.category !== 'string') {
            errors.push('managed3d definition category must be string when present');
        }
        if (definition.category === 'cone_stream') {
            const coneStream = definition.coneStream;
            if (!coneStream || typeof coneStream !== 'object') {
                errors.push('cone_stream definition requires coneStream object');
            } else {
                if (coneStream.schemaVersion !== CONE_STREAM_SCHEMA_VERSION) {
                    errors.push(`coneStream schemaVersion must be ${CONE_STREAM_SCHEMA_VERSION}`);
                }
                if (coneStream.mode !== 'cone' && coneStream.mode !== 'stream') {
                    errors.push('coneStream.mode must be "cone" or "stream"');
                }
                if (typeof coneStream.attachTo !== 'string' || coneStream.attachTo.length === 0) {
                    errors.push('coneStream.attachTo must be a non-empty string');
                }
                if (typeof coneStream.aimAt !== 'string' || coneStream.aimAt.length === 0) {
                    errors.push('coneStream.aimAt must be a non-empty string');
                }
                if (typeof coneStream.length !== 'number') {
                    errors.push('coneStream.length must be a number');
                }
                if (typeof coneStream.spreadDeg !== 'number') {
                    errors.push('coneStream.spreadDeg must be a number');
                }
                if (typeof coneStream.lifetimeMs !== 'number') {
                    errors.push('coneStream.lifetimeMs must be a number');
                }
                if (typeof coneStream.fadeOutMs !== 'number') {
                    errors.push('coneStream.fadeOutMs must be a number');
                }
                if (typeof coneStream.flicker !== 'boolean') {
                    errors.push('coneStream.flicker must be a boolean');
                }
            }
        }
    }
    if (definition.transport === 'legacy') {
        if (typeof definition.legacyType !== 'string' || definition.legacyType.length === 0) {
            errors.push('legacy definition requires legacyType');
        }
        if (definition.factoryKey !== null && (typeof definition.factoryKey !== 'string' || definition.factoryKey.length === 0)) {
            errors.push('legacy definition factoryKey must be string or null');
        }
        if (typeof definition.buildParams !== 'function') {
            errors.push('legacy definition requires buildParams(context)');
        }
    }
    if (!Array.isArray(definition.contextKeys)) {
        errors.push('contextKeys must be an array');
    }

    return errors;
}

function buildValidatedDefinitions(rawDefinitions) {
    const validated = {};
    const issues = [];

    for (const [id, definition] of Object.entries(rawDefinitions)) {
        const errors = validateEffectDefinition(id, definition);
        if (errors.length > 0) {
            issues.push({ id, errors });
            continue;
        }
        validated[id] = Object.freeze({ ...definition });
    }

    if (issues.length > 0) {
        const message = issues
            .map(issue => `${issue.id}: ${issue.errors.join(', ')}`)
            .join(' | ');
        throw new Error(`[EffectDefinitions] Invalid definitions detected: ${message}`);
    }

    return Object.freeze(validated);
}

export const EFFECT_DEFINITIONS = buildValidatedDefinitions(RAW_EFFECT_DEFINITIONS);

export {
    EFFECT_DEFINITION_SCHEMA_VERSION,
    CONE_STREAM_SCHEMA_VERSION,
    MANAGED_CONE_STREAM_SCHEMA_TEMPLATE,
    validateEffectDefinition
};
