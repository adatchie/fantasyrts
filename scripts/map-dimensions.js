import { MAP_W, MAP_H } from './constants.js';

export function getMapDimensions(mapSource) {
    if (mapSource?.getDimensions) return mapSource.getDimensions();
    if (Array.isArray(mapSource)) {
        return { width: mapSource[0]?.length || MAP_W, height: mapSource.length || MAP_H };
    }
    return { width: MAP_W, height: MAP_H };
}

export function isWithinMap(x, y, mapSource) {
    const { width, height } = getMapDimensions(mapSource);
    return x >= 0 && x < width && y >= 0 && y < height;
}
