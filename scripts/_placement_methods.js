/**
 * キーボード入力ハンドラー
 */
onKeyDown(e) {
    // 配置モード中の回転
    if (this.state === 'PLACEMENT' && (e.key === 'r' || e.key === 'R')) {
        this.placementRotation = (this.placementRotation + 1) % 4;
        console.log(`Rotation: ${this.placementRotation * 90}°`);
        this.updatePlacementGhost();
    }

    // エスケープキーで配置モードをキャンセル
    if (e.key === 'Escape' && this.state === 'PLACEMENT') {
        this.cancelPlacementMode();
    }

    // マップ保存 (Shift+P)
    if (e.key === 'P' && e.shiftKey) {
        this.exportMapData();
    }
}

/**
 * 建物配置モードに入る
 */
enterBuildingPlacementMode(buildingData) {
    console.log("Enter Placement Mode");
    this.state = 'PLACEMENT';
    this.placementData = buildingData;
    this.placementRotation = 0;
    this.updatePlacementGhost();
}

/**
 * 配置モードをキャンセル
 */
cancelPlacementMode() {
    console.log("Cancel Placement Mode");
    this.state = 'PLAYING';
    this.placementData = null;
    this.placementRotation = 0;

    if (this.placementGhost) {
        this.renderingEngine.scene.remove(this.placementGhost);
        this.placementGhost = null;
    }
}

/**
 * 配置ゴーストを更新
 */
updatePlacementGhost() {
    // 古いゴーストを削除
    if (this.placementGhost) {
        this.renderingEngine.scene.remove(this.placementGhost);
        this.placementGhost = null;
    }

    if (!this.placementData) return;

    // 回転を適用
    const { blocks, size } = this.buildingSystem.rotateBlocks(
        this.placementData.blocks,
        this.placementData.size,
        this.placementRotation
    );
    const tempTemplate = { ...this.placementData, blocks, size };

    // ゴースト作成
    const mesh = this.buildingSystem.createBuildingMesh(tempTemplate, 0, 0, 0);

    // 半透明化
    mesh.traverse((child) => {
        if (child.isMesh) {
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = 0.5;
            child.material.depthWrite = false;
        }
    });

    this.placementGhost = mesh;
    this.renderingEngine.scene.add(this.placementGhost);
}

/**
 * 現在の建物を配置
 */
placeCurrentBuilding() {
    if (!this.placementData || !this.input.hoverHex) return;

    const hex = this.input.hoverHex;

    this.buildingSystem.placeCustomBuildingAtGrid(
        this.placementData,
        hex.x,
        hex.y,
        this.placementRotation
    );

    console.log(`Placed building at (${hex.x}, ${hex.y}) Rotation: ${this.placementRotation * 90}°`);
}

/**
 * マップデータをエクスポート
 */
exportMapData() {
    const buildings = this.buildingSystem.getPlacedBuildingsData();
    const data = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        buildings: buildings
    };
    const json = JSON.stringify(data, null, 2);
    console.log("=== EXPORTED MAP DATA ===");
    console.log(json);
    console.log("=========================");
    alert("マップデータをコンソールに出力しました。\nF12キーを押してコンソールを開き、データをコピーしてください。");
}
