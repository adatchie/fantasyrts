/**
 * Event Manager Module
 * 会話イベントの再生、条件判定、進行管理を行う
 */

export class EventManager {
    constructor(game) {
        this.game = game;
        this.events = null;
        this.currentDialogue = null;
        this.dialogueIndex = 0;
        this.onCompleteCallback = null;
        this._isAnimating = false; // 連打防止フラグ
        this._domInitialized = false; // DOM遅延取得フラグ

        // 発生済みイベントの管理（重複発生防止）
        this.triggeredEvents = new Set();

        // UI要素（DOM Ready前にコンストラクタが走る可能性があるため遅延取得）
        this.layer = null;
        this.topBox = null;
        this.topName = null;
        this.topText = null;
        this.topImg = null;
        this.topPlaceholder = null;
        this.bottomBox = null;
        this.bottomName = null;
        this.bottomText = null;
        this.bottomImg = null;
        this.bottomPlaceholder = null;
    }

    /**
     * DOM要素の遅延取得とイベントリスナー登録
     * 初回呼び出し時にのみ実行される
     */
    _ensureDom() {
        const currentLayer = document.getElementById('conversation-layer');
        if (this._domInitialized && this.layer === currentLayer) return;
        this._domInitialized = true;

        this.layer = currentLayer;
        this.topBox = document.getElementById('dialogue-top');
        this.topName = document.getElementById('dialogue-top-name');
        this.topText = document.getElementById('dialogue-top-text');
        this.topImg = document.getElementById('dialogue-top-img');
        this.topPlaceholder = document.getElementById('dialogue-top-img-placeholder');

        this.bottomBox = document.getElementById('dialogue-bottom');
        this.bottomName = document.getElementById('dialogue-bottom-name');
        this.bottomText = document.getElementById('dialogue-bottom-text');
        this.bottomImg = document.getElementById('dialogue-bottom-img');
        this.bottomPlaceholder = document.getElementById('dialogue-bottom-img-placeholder');

        // タップイベント登録（バブリング防止）
        if (this.layer) {
            this.layer.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
            this.layer.addEventListener('mousedown', (e) => { e.stopPropagation(); });
            this.layer.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: false });
        }
    }

    /**
     * ステージデータからイベントを読み込む
     */
    loadEvents(eventsData) {
        this.events = eventsData || [];

        // オブジェクト形式（旧形式）だった場合は、エディター互換の配列形式に正規化する
        if (this.events && !Array.isArray(this.events) && typeof this.events === 'object') {
            let normalizedEvents = [];

            if (this.events.onStart && Array.isArray(this.events.onStart)) {
                normalizedEvents.push({
                    id: 'ev_start',
                    type: 'onStart',
                    name: '開始時イベント',
                    dialogue: [...this.events.onStart]
                });
            }

            if (this.events.onPhase && Array.isArray(this.events.onPhase)) {
                this.events.onPhase.forEach((ev, idx) => {
                    normalizedEvents.push({
                        id: ev.id || `ev_phase_${idx}`,
                        type: 'onPhase',
                        name: `フェーズイベント ${idx + 1}`,
                        condition: ev.condition,
                        dialogue: [...ev.dialogue]
                    });
                });
            }

            if (this.events.onClear && Array.isArray(this.events.onClear)) {
                normalizedEvents.push({
                    id: 'ev_clear',
                    type: 'onClear',
                    name: 'クリア時イベント',
                    dialogue: [...this.events.onClear]
                });
            }

            this.events = normalizedEvents;
        }

        this.triggeredEvents.clear();
        console.log("[EventManager] Events loaded:", this.events);
    }

    /**
     * ステージ開始時のイベントチェック
     */
    async triggerStartEvent() {
        if (!this.events || !Array.isArray(this.events)) return false;
        if (this.triggeredEvents.has('start')) return false;

        const startEvents = this.events.filter(e => e.type === 'onStart');
        if (startEvents.length === 0) return false;

        this.triggeredEvents.add('start');
        console.log("[EventManager] Triggering Start Event");

        return new Promise(resolve => {
            this.startConversation(startEvents[0].dialogue, resolve);
        });
    }

    /**
     * フェイズ開始時（ORDER遷移時）のイベントチェック
     */
    async triggerPhaseEvent(units, turnCount) {
        console.log(`[EventManager] triggerPhaseEvent called. Turn: ${turnCount}, this.events:`, this.events);
        if (!this.events || !Array.isArray(this.events)) {
            console.log("[EventManager] triggerPhaseEvent aborted: events is not an array");
            return false;
        }

        const phaseEvents = this.events.filter(e => e.type === 'onPhase');
        if (phaseEvents.length === 0) return false;

        let triggered = false;
        for (let i = 0; i < phaseEvents.length; i++) {
            const event = phaseEvents[i];
            const eventId = event.id || `phase_${i}`;

            if (this.triggeredEvents.has(eventId)) continue;

            const cond = event.condition;
            if (!cond) continue;
            let match = false;

            if (cond.type === 'turn' && cond.value === turnCount) {
                console.log(`[EventManager] Match found for turn condition! Target: ${cond.value}, Current: ${turnCount}`);
                match = true;
            } else if (cond.type === 'unitDefeated') {
                // 指定武将のユニット（特に本陣など）が全滅しているか
                // cond.valueには武将ID（またはユニットID）が文字列で入っている想定
                const hasMatchingUnit = units.some(u => u.id === cond.value || u.name === cond.value || u.warlordId === cond.value);
                if (hasMatchingUnit) {
                    const isAlive = units.some(u => (u.id === cond.value || u.name === cond.value || u.warlordId === cond.value) && !u.dead);
                    console.log(`[EventManager] UnitDefeated check for '${cond.value}': Exists=${hasMatchingUnit}, isAlive=${isAlive}`);
                    if (!isAlive) match = true;
                } else {
                    console.log(`[EventManager] UnitDefeated check for '${cond.value}': Target unit not found on map.`);
                }
            }

            if (match) {
                this.triggeredEvents.add(eventId);
                console.log(`[EventManager] Triggering Phase Event: ${eventId}`);

                // 一度に1イベントだけ再生するようにawait
                await new Promise(resolve => {
                    this.startConversation(event.dialogue, resolve);
                });
                triggered = true;
                break; // 同一フェイズに複数起きた場合は最初の一つだけにするか選択できるが、今回はブレイクする
            }
        }

        return triggered;
    }

    /**
     * ステージクリア時のイベントチェック
     */
    async triggerClearEvent(winnerSide) {
        console.log(`[EventManager] triggerClearEvent called. Winner: ${winnerSide}, this.events:`, this.events);
        if (!this.events || !Array.isArray(this.events)) {
            console.log("[EventManager] triggerClearEvent aborted: events is not an array");
            return false;
        }
        if (this.triggeredEvents.has('clear')) return false;

        const clearEvents = this.events.filter(e => e.type === 'onClear');
        if (clearEvents.length === 0) return false;

        this.triggeredEvents.add('clear');
        console.log("[EventManager] Triggering Clear Event");

        return new Promise(resolve => {
            this.startConversation(clearEvents[0].dialogue, resolve);
        });
    }

    /**
     * 会話の再生開始
     */
    startConversation(dialogueArray, onCompleteCallback) {
        this._ensureDom();
        if (!this.layer || !dialogueArray || dialogueArray.length === 0) {
            if (onCompleteCallback) onCompleteCallback();
            return;
        }

        this.currentDialogue = dialogueArray;
        this.dialogueIndex = 0;
        this.onCompleteCallback = onCompleteCallback;

        this.layer.classList.add('active'); // activeにしてクリックを拾うようにする

        // 会話中はHUD要素を隠す（action-btnはz-index:9999のfixed要素で会話レイヤーより前面に出るため）
        const actionBtn = document.getElementById('action-btn');
        const speedControl = document.getElementById('speed-control');
        if (actionBtn) { this._prevActionBtnDisplay = actionBtn.style.display; actionBtn.style.display = 'none'; }
        if (speedControl) { this._prevSpeedControlDisplay = speedControl.style.display; speedControl.style.display = 'none'; }

        // 以前のゲーム状態を保存し、EVENTステートにする（裏でゲームが進まないようにする）
        this.previousGameState = this.game.gameState;
        this.game.gameState = 'EVENT';

        this.showNextDialogue();
    }

    /**
     * クリック/タップの処理
     */
    handlePointerDown(e) {
        // イベントブロック
        e.preventDefault();
        e.stopPropagation();

        // アニメーション中は入力を無視（連打によるスキップ・二重終了防止）
        if (this._isAnimating) return;

        if (this.currentDialogue) {
            this.showNextDialogue();
        }
    }

    /**
     * 次のセリフを表示、または終了
     */
    showNextDialogue() {
        if (this.dialogueIndex >= this.currentDialogue.length) {
            this.endConversation();
            return;
        }

        const diag = this.currentDialogue[this.dialogueIndex];
        this._isAnimating = true; // アニメーション開始

        // 特殊コマンド：明示的なウィンドウ消去指定がある場合
        if (diag.clear) {
            if (diag.clear === 'top' || diag.clear === 'both') {
                this.topBox.classList.remove('show');
            }
            if (diag.clear === 'bottom' || diag.clear === 'both') {
                this.bottomBox.classList.remove('show');
            }
        }

        // 基本方針: 話者となる側だけ一旦非表示にして再表示アニメーションさせる。
        // もう片方はそのまま残して、掛け合い感を出す。
        if (diag.position === 'top') {
            this.topBox.classList.remove('show');
        } else {
            this.bottomBox.classList.remove('show');
        }

        // 話者以外を非表示にせず、話者のみ表示して内容をセット
        setTimeout(() => {
            // 会話がキャンセルされていないかチェック
            if (!this.currentDialogue) {
                this._isAnimating = false;
                return;
            }
            if (diag.position === 'top') {
                this.topName.innerText = diag.speaker;
                this.topText.innerText = diag.text;
                if (diag.portrait) {
                    this.topImg.src = diag.portrait.startsWith('data:image') || diag.portrait.startsWith('http') || diag.portrait.startsWith('./') ? diag.portrait : `./portraits/${diag.portrait}`;
                    this.topImg.style.display = 'block';
                    this.topPlaceholder.style.display = 'none';
                } else {
                    this.topImg.style.display = 'none';
                    this.topPlaceholder.style.display = 'flex';
                    this.topPlaceholder.innerText = diag.speaker.charAt(0);
                }
                this.topBox.classList.add('show');
            } else {
                this.bottomName.innerText = diag.speaker;
                this.bottomText.innerText = diag.text;
                if (diag.portrait) {
                    this.bottomImg.src = diag.portrait.startsWith('data:image') || diag.portrait.startsWith('http') || diag.portrait.startsWith('./') ? diag.portrait : `./portraits/${diag.portrait}`;
                    this.bottomImg.style.display = 'block';
                    this.bottomPlaceholder.style.display = 'none';
                } else {
                    this.bottomImg.style.display = 'none';
                    this.bottomPlaceholder.style.display = 'flex';
                    this.bottomPlaceholder.innerText = diag.speaker.charAt(0);
                }
                this.bottomBox.classList.add('show');
            }
            this.dialogueIndex++;
            this._isAnimating = false; // アニメーション完了
        }, 80); // アニメーションリセットのためのわずかな遅延
    }

    /**
     * 会話終了処理
     */
    endConversation() {
        this._isAnimating = true; // 終了アニメーション中もブロック
        this.topBox.classList.remove('show');
        this.bottomBox.classList.remove('show');

        setTimeout(() => {
            this.layer.classList.remove('active');

            // 会話終了後にHUD要素を復元
            const actionBtn = document.getElementById('action-btn');
            const speedControl = document.getElementById('speed-control');
            if (actionBtn) actionBtn.style.display = this._prevActionBtnDisplay || 'block';
            if (speedControl) speedControl.style.display = this._prevSpeedControlDisplay || 'flex';

            this.currentDialogue = null;
            this._isAnimating = false;
            this.game.gameState = this.previousGameState || 'ORDER';

            if (this.onCompleteCallback) {
                const cb = this.onCompleteCallback;
                this.onCompleteCallback = null;
                cb();
            }
        }, 300); // fadeOutを待つ
    }
}
