function Replace-Lines {
    param(
        [string]$Path,
        [scriptblock]$Transform
    )
    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in Get-Content $Path) { [void]$lines.Add($line) }
    & $Transform $lines
    Set-Content $Path $lines
}

Replace-Lines -Path 'scripts/pathfinding.js' -Transform {
    param($lines)

    $start = $lines.FindIndex({ param($line) $line -like '*敵ユニット*ブロック扱い*' })
    if ($start -ge 0) {
        $lines.RemoveRange($start, 6)
        [string[]]$replacement = @(
            '        // 直進候補は占有マスに弱いので、ゴール以外のユニット占有を避ける',
            '        if (!(straightPath[i].x === goalX && straightPath[i].y === goalY) && blockInfo.blocked) {',
            '            blocked = true;',
            '            break;',
            '        }'
        )
        $lines.InsertRange($start, $replacement)
    }

    $costIdx = $lines.FindIndex({ param($line) $line -like '*味方ユニットがいる場合はコスト増*' })
    if ($costIdx -ge 0) {
        $lines.RemoveRange($costIdx, 4)
        [string[]]$replacement = @(
            '            // 味方ユニットがいる場合はコスト増（できるだけ迂回させる）',
            '            if (blockInfo.blocked && blockInfo.isFriendly) {',
            '                moveCost += 12;',
            '            }'
        )
        $lines.InsertRange($costIdx, $replacement)
    }
}

Replace-Lines -Path 'scripts/combat.js' -Transform {
    param($lines)

    $moveStart = $lines.FindIndex({ param($line) $line -like '*async moveUnitStep(unit, dest, allUnits, map)*' })
    $surroundStart = $lines.FindIndex({ param($line) $line -like '*findSurroundPosition(unit, target, allUnits)*' })
    if ($moveStart -ge 0 -and $surroundStart -gt $moveStart) {
        $lines.RemoveRange($moveStart, $surroundStart - $moveStart)
        [string[]]$replacement = @(
            '    async moveUnitStep(unit, dest, allUnits, map) {',
            '        let targetQ = dest.x;',
            '        let targetR = dest.y;',
            '',
            '        // 目標がユニット（攻撃対象）の場合、包囲位置を探す',
            '        if (dest.id !== undefined) {',
            '            const surroundPos = this.findSurroundPosition(unit, dest, allUnits);',
            '            if (surroundPos) {',
            '                targetQ = surroundPos.x;',
            '                targetR = surroundPos.y;',
            '            }',
            '        }',
            '',
            '        let moves = unit.movePower || 6;',
            '        let actuallyMoved = false;',
            '',
            '        // ユニット位置の高速検索用Mapを作成 (移動中の衝突判定用)',
            '        // 他のユニットは動かない前提 (ターン制/順次処理)',
            '        const unitMap = new Map();',
            '        for (const u of allUnits) {',
            '            if (!u.dead && u.id !== unit.id) {',
            '                unitMap.set(`${u.x},${u.y}`, u);',
            '            }',
            '        }',
            '',
            '        let safety = 0;',
            '        while (moves > 0 && safety < 64) {',
            '            safety++;',
            '            const path = findPath(unit.x, unit.y, targetQ, targetR, allUnits, unit, this.mapSystem);',
            '            if (!path || path.length === 0 || (path.length === 1 && path[0].x === unit.x && path[0].y === unit.y)) {',
            '                console.warn(`[Pathfinding] Unit ${unit.id} has no valid path to (${targetQ}, ${targetR}). Current pos: (${unit.x}, ${unit.y})`);',
            '                break;',
            '            }',
            '',
            '            const next = path[1];',
            '            if (!next) break;',
            '',
            '            let cost = 1;',
            '            if (this.mapSystem) {',
            '                const canFly = unit.canFly || unit.type === ''FLYING'';',
            '                cost = this.mapSystem.getMoveCost(',
            '                    { x: unit.x, y: unit.y },',
            '                    { x: next.x, y: next.y },',
            '                    canFly',
            '                );',
            '            } else if (map && map[next.y] && map[next.y][next.x]) {',
            '                const t = map[next.y][next.x];',
            '                if (TERRAIN_TYPES[t.type]) {',
            '                    cost = TERRAIN_TYPES[t.type].moveCost;',
            '                }',
            '            }',
            '',
            '            if (cost === Infinity || cost >= 999) break;',
            '            if (moves < cost) break;',
            '',
            '            const blocker = unitMap.get(`${next.x},${next.y}`);',
            '',
            '            if (blocker) {',
            '                if (blocker.side === unit.side) {',
            '                    const rerouteUnits = allUnits.filter(u => u.id !== blocker.id);',
            '                    const altPath = findPath(unit.x, unit.y, targetQ, targetR, rerouteUnits, unit, this.mapSystem);',
            '                    if (altPath && altPath[1] && !(altPath[1].x === next.x && altPath[1].y === next.y)) {',
            '                        continue;',
            '                    }',
            '',
            '                    unit.dir = getFacingAngle(unit.x, unit.y, next.x, next.y);',
            '                    unitMap.delete(`${blocker.x},${blocker.y}`);',
            '',
            '                    blocker.x = unit.x;',
            '                    blocker.y = unit.y;',
            '                    blocker.pos = hexToPixel(blocker.x, blocker.y);',
            '                    unitMap.set(`${blocker.x},${blocker.y}`, blocker);',
            '',
            '                    unit.x = next.x;',
            '                    unit.y = next.y;',
            '                    unit.pos = hexToPixel(unit.x, unit.y);',
            '                    actuallyMoved = true;',
            '                    moves -= cost;',
            '',
            '                    if (unit.order && unit.order.originalTargetId) {',
            '                        const targetUnit = allUnits.find(u => u.id === unit.order.originalTargetId);',
            '                        if (targetUnit) {',
            '                            const typeInfo = UNIT_TYPES[unit.type] || UNIT_TYPES.INFANTRY;',
            '                            const rangeType = typeInfo.rangeType || ''melee'';',
            '                            const isRanged = [''bowArc'', ''longArc'', ''siege'', ''aoe'', ''breath'', ''heal''].includes(rangeType);',
            '',
            '                            if (isRanged) {',
            '                                let currentRange = 8;',
            '                                if (rangeType === ''aoe'') currentRange = 6;',
            '                                if (rangeType === ''breath'') currentRange = 4;',
            '                                if (rangeType === ''siege'') currentRange = 12;',
            '                                if (rangeType === ''heal'') currentRange = 5;',
            '',
            '                                if (this.mapSystem) {',
            '                                    const uZ = this.mapSystem.getHeight(unit.x, unit.y);',
            '                                    const tZ = this.mapSystem.getHeight(targetUnit.x, targetUnit.y);',
            '                                    if (uZ > tZ) {',
            '                                        const hDiff = Math.floor((uZ - tZ) / 16);',
            '                                        currentRange = Math.min(currentRange + hDiff, currentRange + 4);',
            '                                    }',
            '                                }',
            '',
            '                                const distToTarget = getDistAttack(unit, targetUnit);',
            '                                const minRange = 2;',
            '                                if (distToTarget >= minRange && distToTarget <= currentRange) {',
            '                                    moves = 0;',
            '                                    break;',
            '                                }',
            '                            }',
            '                        }',
            '                    }',
            '',
            '                    await this.wait(20);',
            '                    continue;',
            '                }',
            '',
            '                if (next.x === targetQ && next.y === targetR && dest.id !== undefined) {',
            '                    break;',
            '                }',
            '',
            '                const reroutePath = findPath(unit.x, unit.y, targetQ, targetR, allUnits, unit, this.mapSystem);',
            '                if (reroutePath && reroutePath[1] && !(reroutePath[1].x === next.x && reroutePath[1].y === next.y)) {',
            '                    continue;',
            '                }',
            '',
            '                console.warn(`[Pathfinding] Unit ${unit.id} blocked by enemy at (${next.x}, ${next.y}). Path:`, path);',
            '                return actuallyMoved;',
            '            }',
            '',
            '            unit.dir = getFacingAngle(unit.x, unit.y, next.x, next.y);',
            '            unit.x = next.x;',
            '            unit.y = next.y;',
            '            unit.pos = hexToPixel(unit.x, unit.y);',
            '            actuallyMoved = true;',
            '            moves -= cost;',
            '            await this.wait(20);',
            '        }',
            '',
            '        if (dest && getDistRaw(unit.x, unit.y, dest.x, dest.y) > 0) {',
            '            unit.dir = getFacingAngle(unit.x, unit.y, dest.x, dest.y);',
            '        }',
            '',
            '        return actuallyMoved;',
            '    }',
            '',
            '    /**',
            '     * 包囲位置を探す',
            '     * 目標の周囲で空いているスペースを見つける',
            '     */'
        )
        $lines.InsertRange($moveStart, $replacement)
    }

    $surroundStart = $lines.FindIndex({ param($line) $line -like '*findSurroundPosition(unit, target, allUnits)*' })
    $combatStart = $lines.FindIndex({ param($line) $line -like '*async combat(att, def, allUnits, map)*' })
    if ($surroundStart -ge 0 -and $combatStart -gt $surroundStart) {
        $lines.RemoveRange($surroundStart, $combatStart - $surroundStart)
        [string[]]$replacement = @(
            '    findSurroundPosition(unit, target, allUnits) {',
            '        const directions = [',
            '            [+1, 0],',
            '            [-1, 0],',
            '            [0, +1],',
            '            [0, -1]',
            '        ];',
            '',
            '        const MAX_WALKABLE_HEIGHT_DIFF = 2 * TILE_HEIGHT;',
            '        const surroundPositions = [];',
            '        for (const [dx, dy] of directions) {',
            '            const nx = target.x + dx;',
            '            const ny = target.y + dy;',
            '',
            '            if (this.mapSystem) {',
            '                const unitZ = this.mapSystem.getHeight(unit.x, unit.y);',
            '                const targetZ = this.mapSystem.getHeight(nx, ny);',
            '                const heightDiff = Math.abs(targetZ - unitZ);',
            '                if (heightDiff > MAX_WALKABLE_HEIGHT_DIFF) {',
            '                    continue;',
            '                }',
            '            }',
            '',
            '            const isOccupied = allUnits.some(u =>',
            '                u.id !== unit.id &&',
            '                !u.dead &&',
            '                u.x === nx && u.y === ny',
            '            );',
            '',
            '            if (!isOccupied) {',
            '                const dist = getDistRaw(unit.x, unit.y, nx, ny);',
            '                surroundPositions.push({ x: nx, y: ny, dist });',
            '            }',
            '        }',
            '',
            '        if (surroundPositions.length === 0) return null;',
            '',
            '        const reachablePositions = surroundPositions',
            '            .map(pos => {',
            '                const path = findPath(unit.x, unit.y, pos.x, pos.y, allUnits, unit, this.mapSystem);',
            '                if (!path || path.length <= 1) return null;',
            '                return { ...pos, pathLength: path.length };',
            '            })',
            '            .filter(Boolean);',
            '',
            '        if (reachablePositions.length > 0) {',
            '            reachablePositions.sort((a, b) => {',
            '                if (a.pathLength !== b.pathLength) return a.pathLength - b.pathLength;',
            '                return a.dist - b.dist;',
            '            });',
            '            return reachablePositions[0];',
            '        }',
            '',
            '        surroundPositions.sort((a, b) => a.dist - b.dist);',
            '        return surroundPositions[0];',
            '    }',
            '',
            '    /**',
            '     * 戦闘を実行',
            '     */'
        )
        $lines.InsertRange($surroundStart, $replacement)
    }
}

