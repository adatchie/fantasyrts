import * as THREE from 'three';

// 天候プリセット（スカイドーム＆ライティング設定）
export const WEATHER_PRESETS = {
    clear: {
        skyTop: 0x1a3a6a,      // 天頂（濃い青）
        skyHorizon: 0x5588aa,  // 地平線（明るい青）
        groundHorizon: 0x334433, // 地面境界（暗い緑）
        sunColor: 0xffffee,    // 太陽の色
        sunIntensity: 1.2,     // 太陽の強さ
        ambientIntensity: 0.8, // 環境光の強さ
        ambientColor: 0xffffff,// 環境光の色
        fogColor: 0x223344,    // 霧の色（遠方用）
        fogDensity: 0.0002     // 霧の濃さ
    },
    sunset: {
        skyTop: 0x221133,
        skyHorizon: 0xcc6633,
        groundHorizon: 0x442222,
        sunColor: 0xffaa55,
        sunIntensity: 0.8,
        ambientIntensity: 0.5,
        ambientColor: 0xffddcc,
        fogColor: 0x552211,
        fogDensity: 0.0005
    },
    overcast: {
        skyTop: 0x555566,
        skyHorizon: 0x888899,
        groundHorizon: 0x444444,
        sunColor: 0xdddddd,
        sunIntensity: 0.4,
        ambientIntensity: 0.6,
        ambientColor: 0xaaaaaa,
        fogColor: 0x777788,
        fogDensity: 0.0008
    },
    night: {
        skyTop: 0x050511,
        skyHorizon: 0x111122,
        groundHorizon: 0x0a0a0a,
        sunColor: 0x88aaff,    // 月の光として代用
        sunIntensity: 0.2,
        ambientIntensity: 0.3,
        ambientColor: 0x445588,
        fogColor: 0x0a0a1a,
        fogDensity: 0.001
    }
};

/**
 * 空、天候、および大気エフェクトを管理するクラス
 * OrthographicCameraでも正常に表示されるようにカスタムシェーダーによる
 * スカイドーム（大きな球体）を使用します。
 */
export default class SkyManager {
    /**
     * @param {Object} renderingEngine - RenderingEngine3Dインスタンス
     */
    constructor(renderingEngine) {
        this.engine = renderingEngine;
        this.scene = renderingEngine.scene;

        // パラメータ
        this.domeRadius = 4000; // カメラ(far=10000)に収まる十分な大きさ
        this.currentWeather = 'clear';
        this.transitionProgress = 1.0;
        this.transitionSpeed = 0.5; // 秒あたりの遷移率

        // 現在の色状態（補間用）
        this.state = this._clonePreset(WEATHER_PRESETS.clear);
        this.targetState = null;

        // 太陽の方向（DirectionalLightと同期）
        this.sunDirection = new THREE.Vector3(0.5, 1.0, 0.5).normalize();

        this._initSkyDome();
        this._initSun();
        this._initGround();

        // 初期状態の適用
        this.applyWeatherInstant(this.currentWeather);
    }

    /**
     * スカイドームメッシュを初期化する
     */
    _initSkyDome() {
        // 球体ジオメトリ作成（内側を描画する）
        const geometry = new THREE.SphereGeometry(this.domeRadius, 32, 15);

        // グラデーションを描画するカスタムシェーダーマテリアル
        const vertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `;

        const fragmentShader = `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform vec3 groundColor; // 地平線より下（地面と接する部分）の色
            uniform float offset;
            uniform float exponent;
            
            varying vec3 vWorldPosition;
            
            void main() {
                // ドームの高さ(Y)に基づいてグラデーションを計算
                // Y=0付近を中心にミックスする
                float h = normalize(vWorldPosition + offset).y;
                if (h > 0.0) {
                    // 空の上半球
                    gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h, 0.0), exponent)), 1.0);
                } else {
                    // 地平線より下は地面の色にスムーズにブレンドし、切れ目を消す
                    float blend = smoothstep(-0.05, 0.0, h);
                    gl_FragColor = vec4(mix(groundColor, bottomColor, blend), 1.0);
                }
            }
        `;

        this.skyUniforms = {
            topColor: { value: new THREE.Color(this.state.skyTop) },
            bottomColor: { value: new THREE.Color(this.state.skyHorizon) },
            groundColor: { value: new THREE.Color(this.state.groundHorizon) }, // 追加
            offset: { value: 33 },      // 地平線の高さオフセット
            exponent: { value: 0.6 }    // グラデーションの変化率
        };

        const material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: this.skyUniforms,
            side: THREE.BackSide,      // 球の内側を描画
            depthWrite: false          // 他のオブジェクトの描画順序に影響させない
        });

        this.skyMesh = new THREE.Mesh(geometry, material);
        // ★重要: スカイドームがマウスクリック（Raycast）を妨害しないよう無効化
        this.skyMesh.raycast = function () { };
        // カメラの追従はupdate()で行う

        this.scene.add(this.skyMesh);
    }

    /**
     * 太陽（または月）メッシュを初期化する
     */
    _initSun() {
        const geometry = new THREE.CircleGeometry(200, 32);
        const material = new THREE.MeshBasicMaterial({
            color: this.state.sunColor,
            transparent: true,
            opacity: 0.9,
            fog: false,
            blending: THREE.AdditiveBlending
        });

        this.sunMesh = new THREE.Mesh(geometry, material);
        // 太陽のRaycast判定を無効化
        this.sunMesh.raycast = function () { };
        // ドームより少し内側に配置
        this.sunDistance = this.domeRadius - 100;

        this.scene.add(this.sunMesh);
    }

    /**
     * 環境としての地面（無限平面）を初期化する
     */
    _initGround() {
        // カメラのfar内に収まる十分な大きさの平面
        const geometry = new THREE.PlaneGeometry(8000, 8000);

        // シンプルにライティングの影響を受けるマテリアル
        const material = new THREE.MeshLambertMaterial({
            color: this.state.groundHorizon,
            // receiveShadowは現状パフォーマンス考慮で一旦false
        });

        this.skyGroundMesh = new THREE.Mesh(geometry, material);
        // 地面の巨大平面がRaycastを阻害しないよう無効化
        this.skyGroundMesh.raycast = function () { };
        // 水平にするための回転
        this.skyGroundMesh.rotation.x = -Math.PI / 2;
        // 地平線として空(グラデーション)が見えるよう、タイル描画の遥か下へ配置する
        this.skyGroundMesh.position.y = -1000.0;

        this.scene.add(this.skyGroundMesh);
    }

    /**
     * プリセットオブジェクトをクローン（単一階層）

     */
    _clonePreset(preset) {
        return {
            skyTop: new THREE.Color(preset.skyTop),
            skyHorizon: new THREE.Color(preset.skyHorizon),
            groundHorizon: new THREE.Color(preset.groundHorizon),
            sunColor: new THREE.Color(preset.sunColor),
            sunIntensity: preset.sunIntensity,
            ambientIntensity: preset.ambientIntensity,
            ambientColor: new THREE.Color(preset.ambientColor),
            fogColor: new THREE.Color(preset.fogColor),
            fogDensity: preset.fogDensity
        };
    }

    /**
     * 単一のライティングコンポーネントのみを同期
     */
    _syncLights() {
        // DirectionalLightが存在する場合は同期
        if (this.engine.directionalLight) {
            this.engine.directionalLight.color.copy(this.state.sunColor);
            this.engine.directionalLight.intensity = this.state.sunIntensity;
        }

        // AmbientLightが存在する場合は同期
        if (this.engine.ambientLight) {
            this.engine.ambientLight.color.copy(this.state.ambientColor);
            this.engine.ambientLight.intensity = this.state.ambientIntensity;
        }

        // フォグの設定
        if (this.state.fogDensity > 0) {
            if (!this.scene.fog) {
                this.scene.fog = new THREE.FogExp2(this.state.fogColor.getHex(), this.state.fogDensity);
            } else {
                this.scene.fog.color.copy(this.state.fogColor);
                this.scene.fog.density = this.state.fogDensity;
            }
        } else {
            this.scene.fog = null;
        }
    }

    /**
     * 天候を即座に適用する
     * @param {string} presetName - 'clear', 'sunset', 'overcast', 'night'
     */
    applyWeatherInstant(presetName) {
        if (!WEATHER_PRESETS[presetName]) {
            console.warn(`[SkyManager] Unknown weather preset: ${presetName}`);
            return;
        }

        this.currentWeather = presetName;
        const preset = WEATHER_PRESETS[presetName];

        this.state = this._clonePreset(preset);
        this.transitionProgress = 1.0;
        this.targetState = null;

        // ユニフォーム変数の更新
        this.skyUniforms.topColor.value.copy(this.state.skyTop);
        this.skyUniforms.bottomColor.value.copy(this.state.skyHorizon);
        this.skyUniforms.groundColor.value.copy(this.state.groundHorizon);

        // 太陽の更新
        this.sunMesh.material.color.copy(this.state.sunColor);
        this.sunMesh.material.opacity = this.state.sunIntensity;

        // 地面の更新
        if (this.skyGroundMesh) {
            this.skyGroundMesh.material.color.copy(this.state.groundHorizon);
        }

        // ライティングとフォグの更新
        this._syncLights();
    }

    /**
     * 天候を徐々に切り替える
     * @param {string} presetName 
     * @param {number} duration - 遷移時間(秒)
     */
    transitionWeather(presetName, duration = 2.0) {
        if (!WEATHER_PRESETS[presetName] || this.currentWeather === presetName) return;

        this.currentWeather = presetName;
        this.targetState = WEATHER_PRESETS[presetName];
        this.transitionSpeed = 1.0 / duration;
        this.transitionProgress = 0.0;
    }

    /**
     * 毎フレームの更新処理。レンダリングエンジンのanimate()から呼ばれる
     */
    update(deltaTime) {
        try {
            // 1. スカイドームと太陽をカメラ位置に追従させる（平行移動）
            if (this.engine.camera) {
                const targetPos = (this.engine.controls && this.engine.controls.target)
                    ? this.engine.controls.target
                    : this.engine.camera.position;

                // ドームと地面はXZ平面で追従、Yは固定
                this.skyMesh.position.set(targetPos.x, 0, targetPos.z);
                if (this.skyGroundMesh) {
                    this.skyGroundMesh.position.set(targetPos.x, -1000.0, targetPos.z);
                }

                // 太陽は光源の方向に基づいて再配置
                if (this.engine.directionalLight) {
                    this.sunDirection.copy(this.engine.directionalLight.position).normalize();
                }

                const sx = this.skyMesh.position.x + this.sunDirection.x * this.sunDistance;
                const sy = this.skyMesh.position.y + this.sunDirection.y * this.sunDistance;
                const sz = this.skyMesh.position.z + this.sunDirection.z * this.sunDistance;

                this.sunMesh.position.set(sx, sy, sz);
                this.sunMesh.lookAt(this.skyMesh.position);
            }

            // 2. 天候の遷移アニメーション
            if (this.transitionProgress < 1.0 && this.targetState) {
                const dtSec = deltaTime * 0.001 || 0.016;
                this.transitionProgress += this.transitionSpeed * dtSec;

                if (this.transitionProgress >= 1.0) {
                    this.transitionProgress = 1.0;
                    this.applyWeatherInstant(this.currentWeather);
                    return;
                }

                const t = this.transitionProgress < 0.5 ?
                    2 * this.transitionProgress * this.transitionProgress :
                    -1 + (4 - 2 * this.transitionProgress) * this.transitionProgress;

                this.state.skyTop.lerp(new THREE.Color(this.targetState.skyTop), t);
                this.state.skyHorizon.lerp(new THREE.Color(this.targetState.skyHorizon), t);
                this.state.groundHorizon.lerp(new THREE.Color(this.targetState.groundHorizon), t);
                this.state.sunColor.lerp(new THREE.Color(this.targetState.sunColor), t);
                this.state.ambientColor.lerp(new THREE.Color(this.targetState.ambientColor), t);
                this.state.fogColor.lerp(new THREE.Color(this.targetState.fogColor), t);

                this.state.sunIntensity += (this.targetState.sunIntensity - this.state.sunIntensity) * t;
                this.state.ambientIntensity += (this.targetState.ambientIntensity - this.state.ambientIntensity) * t;
                this.state.fogDensity += (this.targetState.fogDensity - this.state.fogDensity) * t;

                this.skyUniforms.topColor.value.copy(this.state.skyTop);
                this.skyUniforms.bottomColor.value.copy(this.state.skyHorizon);
                this.skyUniforms.groundColor.value.copy(this.state.groundHorizon);
                this.sunMesh.material.color.copy(this.state.sunColor);
                if (this.skyGroundMesh) {
                    this.skyGroundMesh.material.color.copy(this.state.groundHorizon);
                }

                this._syncLights();
            }
        } catch (e) {
            // SkyManagerのエラーがゲーム全体を停止させないよう握りつぶす
            console.warn('[SkyManager] update error:', e.message);
        }
    }
}
