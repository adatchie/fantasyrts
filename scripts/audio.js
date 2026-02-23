/**
 * SEKIGAHARA RTS - Audio Engine
 * Web Audio APIを使用した和風BGMと効果音
 */

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isPlaying = false;
        this.tempo = 0.13;
        this.timerID = null;
        this.tick = 0;
        this.section = 0;
        this.sfxVolume = 0.5; // SE音量

        // BGM設定
        this.bgmAudio = null;
        this.bgmEnabled = true;
        this.currentBGMUrl = 'sounds/bgm/battlefield.mp3';

        // 外部サウンドファイルのAudioオブジェクト
        this.sounds = {
            battle: null,
            enemyKill: null,
            allyKilled: null,
            arrangementSuccess: null,
            arrangementFail: null,
            clear: null,
            defeated: null
        };
    }

    init() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AC();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);

            // 外部SEファイルをプリロード
            this.loadSounds();
        } catch (e) {
            console.warn('Audio initialization failed:', e);
        }
    }

    /**
     * 外部サウンドファイルを読み込み
     */
    loadSounds() {
        this.sounds.battle = new Audio('sounds/battle.mp3');
        this.sounds.enemyKill = new Audio('sounds/enemy_kill.mp3');
        this.sounds.allyKilled = new Audio('sounds/ally_killed.mp3');
        this.sounds.arrangementSuccess = new Audio('sounds/arrangement_success.mp3');
        this.sounds.arrangementFail = new Audio('sounds/arrangement_fail.mp3');
        this.sounds.clear = new Audio('sounds/clear.mp3');
        this.sounds.defeated = new Audio('sounds/defeated.mp3');

        // 全てのサウンドに音量を設定
        Object.values(this.sounds).forEach(sound => {
            if (sound) sound.volume = this.sfxVolume;
        });
    }

    /**
     * サウンドを再生するヘルパー関数
     */
    playSound(soundKey) {
        if (!this.bgmEnabled && (soundKey === 'clear' || soundKey === 'defeated')) {
            // ファンファーレもBGM扱いならここで止めることも検討
        }
        const sound = this.sounds[soundKey];
        if (sound) {
            sound.currentTime = 0; // 最初から再生
            sound.play().catch(e => console.warn(`Sound play failed: ${soundKey}`, e));
        }
    }

    playTone(freq, type, att, dec, vol, time) {
        if (!this.ctx) return;
        const t = time || this.ctx.currentTime;
        if (t < this.ctx.currentTime) return;

        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + att);
        g.gain.exponentialRampToValueAtTime(0.001, t + att + dec);

        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + att + dec + 0.5);
    }

    playNoise(dur, vol, time) {
        if (!this.ctx) return;
        try {
            const t = time || this.ctx.currentTime;
            const bSize = this.ctx.sampleRate * dur;
            const buf = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
            const d = buf.getChannelData(0);

            for (let i = 0; i < bSize; i++) d[i] = Math.random() * 2 - 1;

            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const g = this.ctx.createGain();
            const f = this.ctx.createBiquadFilter();

            f.type = 'lowpass';
            f.frequency.value = 800;
            g.gain.setValueAtTime(vol, t);
            g.gain.exponentialRampToValueAtTime(0.01, t + dur);

            src.connect(f);
            f.connect(g);
            g.connect(this.masterGain);
            src.start(t);
        } catch (e) {
            console.warn('Noise playback failed:', e);
        }
    }

    // 和太鼓（低音）
    instTaikoLow(t) {
        this.playTone(55, 'square', 0.02, 0.4, 0.7, t);
        this.playNoise(0.1, 0.5, t);
    }

    // 和太鼓（高音）
    instTaikoHigh(t) {
        this.playTone(110, 'square', 0.01, 0.2, 0.5, t);
        this.playNoise(0.05, 0.3, t);
    }

    // 尺八
    instShakuhachi(n, t, d) {
        this.playTone(n, 'triangle', 0.2, d, 0.15, t);
        this.playNoise(d, 0.02, t);
    }

    // 琴
    instKoto(n, t) {
        this.playTone(n, 'sawtooth', 0.02, 0.6, 0.2, t);
    }

    /**
     * BGMの再生（外部ファイル）
     * @param {string} url - 再生するBGMのURL（省略時はデフォルト）
     */
    playBGM(url) {
        if (url) this.currentBGMUrl = url;

        // 既存のBGMを停止
        this.stopBGM();

        // 外部ファイルを再生
        this.bgmAudio = new Audio(this.currentBGMUrl);
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = this.bgmEnabled ? 0.3 : 0;

        this.isPlaying = true;
        this.bgmAudio.play().catch(e => console.warn('BGM play failed:', e));

        // 旧来のシンセサイザーBGMは使用しない
        // if (this.ctx.state === 'suspended') this.ctx.resume();
        // this.tick = 0;
        // this.section = 0;
        // this.schedule();
    }

    stopBGM() {
        this.isPlaying = false;
        if (this.bgmAudio) {
            this.bgmAudio.pause();
            this.bgmAudio = null;
        }
        if (this.timerID) clearTimeout(this.timerID);
    }

    /**
     * BGMのON/OFF切り替え
     */
    toggleBGM() {
        this.bgmEnabled = !this.bgmEnabled;
        if (this.bgmAudio) {
            this.bgmAudio.volume = this.bgmEnabled ? 0.3 : 0;
        }
        return this.bgmEnabled;
    }

    playFanfare(win) {
        this.stopBGM();
        // 外部SEファイルを使用
        if (win) {
            this.playSound('clear');
        } else {
            this.playSound('defeated');
        }
    }

    sfxSlash() {
        this.playNoise(0.15, 0.6);
        this.playTone(200, 'sawtooth', 0.05, 0.1, 0.3);
    }

    sfxHit() {
        this.playTone(100, 'square', 0.05, 0.1, 0.2);
    }

    // 鬨の声（戦闘開始時）- 外部SEファイル使用
    sfxBattleCry() {
        this.playSound('battle');
    }

    // 敵討ち取り時の斬撃音 - 外部SEファイル使用
    sfxVictorySlash() {
        this.playSound('enemyKill');
    }

    // 味方討ち死に時の斬撃音 - 外部SEファイル使用
    sfxDefeatSlash() {
        this.playSound('allyKilled');
    }

    // 調略成功 - 外部SEファイル使用
    sfxArrangementSuccess() {
        this.playSound('arrangementSuccess');
    }

    // 調略失敗 - 外部SEファイル使用
    sfxArrangementFail() {
        this.playSound('arrangementFail');
    }
    // 弓発射音
    sfxShoot() {
        this.playNoise(0.1, 0.3);
        this.playTone(600, 'triangle', 0.05, 0.1, 0.2);
    }

    // 雷鳴 (Magic)
    sfxThunder() {
        this.playNoise(0.4, 0.6);
        this.playTone(100, 'sawtooth', 0.1, 0.4, 0.5);
        this.playTone(50, 'square', 0.1, 0.5, 0.5);
    }
}
