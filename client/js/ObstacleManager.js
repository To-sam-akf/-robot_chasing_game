// js/ObstacleManager.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class ObstacleManager {
    constructor(scene, worldBounds = { x: 45, z: 45 }) {
        this.scene = scene;
        this.worldBounds = worldBounds;
        this.obstacles = []; // 存储所有障碍物实例 { model, boundingBox }
        this.modelTemplates = {}; // 存储加载好的模型模板，用于克隆
        this.loader = new GLTFLoader();
    }

    /**
     * 异步加载所有需要用到的障碍物模型。
     * @param {Object} modelPaths - 一个对象，键是模型名称，值是文件路径。
     *                              例如: { tree: './assets/tree.glb', rock: './assets/rock.glb' }
     */
    async loadModels(modelPaths) {
        for (const name in modelPaths) {
            try {
                const gltf = await this.loader.loadAsync(modelPaths[name]);
                gltf.scene.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                this.modelTemplates[name] = gltf.scene;
                console.log(`Loaded obstacle model: ${name}`);
            } catch (error) {
                console.error(`Failed to load obstacle model ${name}:`, error);
            }
        }
    }

    /**
     * 在地图上随机生成障碍物。
     * @param {number} count - 要生成的障碍物数量。
     * @param {Array<THREE.Object3D>} safeZones - 一组对象，障碍物不会生成在这些对象的安全半径内。
     *                                          例如: [{ object: playerBot.model, radius: 5 }]
     */
    generateObstacles(count, safeZones = []) {
        this.clearObstacles(); // 先清除旧的障碍物
        const modelKeys = Object.keys(this.modelTemplates);
        if (modelKeys.length === 0) {
            console.warn("No obstacle models loaded, cannot generate obstacles.");
            return;
        }

        for (let i = 0; i < count; i++) {
            // 随机选择一个模型模板并克隆
            const randomKey = modelKeys[Math.floor(Math.random() * modelKeys.length)];
            const model = this.modelTemplates[randomKey].clone();

            let position, validPosition;
            let attempts = 0;
            const maxAttempts = 50; // 防止无限循环

            // 寻找一个有效的位置
            do {
                validPosition = true;
                const x = (Math.random() - 0.5) * this.worldBounds.x * 2;
                const z = (Math.random() - 0.5) * this.worldBounds.z * 2;
                position = new THREE.Vector3(x, 0, z);

                // 检查是否在安全区内
                for (const zone of safeZones) {
                    if (position.distanceTo(zone.object.position) < zone.radius) {
                        validPosition = false;
                        break;
                    }
                }
                if (!validPosition) continue;

                // 检查是否与其他已放置的障碍物重叠
                for (const obstacle of this.obstacles) {
                    if (position.distanceTo(obstacle.model.position) < 4) { // 最小间距
                        validPosition = false;
                        break;
                    }
                }
                attempts++;
            } while (!validPosition && attempts < maxAttempts);

            if (validPosition) {
                model.position.copy(position);
                this.scene.add(model);

                // 计算并存储该障碍物的AABB边界框
                const boundingBox = new THREE.Box3().setFromObject(model);
                this.obstacles.push({ model, boundingBox });
            }
        }
    }

    /**
     * 清除场景中所有的障碍物。
     */
    clearObstacles() {
        this.obstacles.forEach(obstacle => {
            this.scene.remove(obstacle.model);
        });
        this.obstacles = [];
    }

    /**
     * 返回所有障碍物，用于碰撞检测。
     * @returns {Array<{model: THREE.Object3D, boundingBox: THREE.Box3}>}
     */
    getObstacles() {
        return this.obstacles;
    }
}