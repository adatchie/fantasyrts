
import * as THREE from 'three';
import { TILE_SIZE } from './constants.js';

/**
 * TerrainManager (Prototype v3)
 * Single Texture Projection
 */
export default class TerrainManager {
    constructor(renderingEngine) {
        this.renderingEngine = renderingEngine;
        this.scene = renderingEngine.scene;
        this.loader = new THREE.TextureLoader();
        this.mesh = null;
        this.baseTexture = null;
    }

    init() {
        // Load the single "War Map" texture
        this.baseTexture = this.loader.load('./assets/textures/terrain_base.png');
        this.baseTexture.wrapS = THREE.ClampToEdgeWrapping;
        this.baseTexture.wrapT = THREE.ClampToEdgeWrapping; // Don't tile, map 1:1
        
        console.log("Terrain V3 Initialized: Single Texture Projection");
    }

    createTerrain(mapData) {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }

        const width = mapData[0].length;
        const height = mapData.length;
        
        // High resolution for smooth geometry
        const segmentsX = width * 2;
        const segmentsY = height * 2;
        
        const geometry = new THREE.PlaneGeometry(
            width * TILE_SIZE,
            height * TILE_SIZE * 0.866, 
            segmentsX - 1,
            segmentsY - 1
        );

        const positions = geometry.attributes.position;
        const uvs = geometry.attributes.uv;

        // Apply Height (Bilinear Interpolation)
        for (let i = 0; i < positions.count; i++) {
            const u = (i % segmentsX) / (segmentsX - 1);
            const v = Math.floor(i / segmentsX) / (segmentsY - 1);

            const mapX_float = u * (width - 1);
            const mapY_float = (1.0 - v) * (height - 1);

            const x0 = Math.floor(mapX_float);
            const x1 = Math.min(x0 + 1, width - 1);
            const y0 = Math.floor(mapY_float);
            const y1 = Math.min(y0 + 1, height - 1);
            
            const dx = mapX_float - x0;
            const dy = mapY_float - y0;

            const h00 = (mapData[y0] && mapData[y0][x0]) ? mapData[y0][x0].z : 0;
            const h10 = (mapData[y0] && mapData[y0][x1]) ? mapData[y0][x1].z : 0;
            const h01 = (mapData[y1] && mapData[y1][x0]) ? mapData[y1][x0].z : 0;
            const h11 = (mapData[y1] && mapData[y1][x1]) ? mapData[y1][x1].z : 0;

            const hInterpolated = 
                h00 * (1 - dx) * (1 - dy) +
                h10 * dx * (1 - dy) +
                h01 * (1 - dx) * dy +
                h11 * dx * dy;
                
            positions.setZ(i, hInterpolated * 7);
        }

        // Correct Orientation and Normals
        geometry.rotateX(-Math.PI / 2);
        geometry.computeVertexNormals();

        // Custom Shader for Single Texture Projection with Lighting
        const material = new THREE.ShaderMaterial({
            uniforms: {
                mapTexture: { value: this.baseTexture }
            },
            vertexShader: `
                varying vec2 vUv;
                varying float vHeight;
                varying vec3 vNormal;
                
                void main() {
                    vUv = uv;
                    vHeight = position.y;
                    vNormal = normalMatrix * normal;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D mapTexture;
                
                varying vec2 vUv;
                varying float vHeight;
                varying vec3 vNormal;
                
                void main() {
                    // Sample the single projected texture
                    vec4 texColor = texture2D(mapTexture, vUv);
                    
                    // Lighting Calculation to reveal 3D shape
                    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
                    float diff = max(dot(normalize(vNormal), lightDir), 0.0);
                    vec3 ambient = vec3(0.6); // Slightly lower ambient to emphasize shadows
                    
                    // Mix texture with lighting
                    // We preserve the texture's original baked lighting but add real-time shading from the mesh
                    vec3 finalColor = texColor.rgb * (ambient + diff * 0.6);
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
        
        console.log("Terrain V3 Mesh Created (Dark Fantasy Projection)");
    }
}
