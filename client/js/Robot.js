// js/Robot.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Robot {
    constructor(scene) {
        this.scene = scene;
        this.model = null;
        this.moveSpeed = 5.0; // 单位/秒
        // turnSpeed 现在代表最大转向速率 (当 turn_intensity 为 1.0 或 -1.0 时)
        this.turnSpeed = Math.PI; // 调整为每秒 180 度，可以根据手感调整
        this.boundingBox = new THREE.Box3(); // 为机器人自身创建一个边界框
    }

    async load(path) {
        // load 函数保持不变...
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync(path);
            this.model = gltf.scene;
            
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            this.model.position.set(0, 0, 0);
            this.model.scale.set(1, 1, 1);
            this.scene.add(this.model);
            console.log("Robot model loaded successfully.");
        } catch (error) {
            console.error("An error happened while loading the model:", error);
        }
        if (this.model) {
            this.boundingBox.setFromObject(this.model);
        }
    }

    /**
     * 更新机器人的状态，在每一帧调用。
     * @param {number} deltaTime
     * @param {object} commandObject
     * @param {Array} obstacles - 障碍物列表
     */
    update(deltaTime, commandObject, obstacles = []) {
        if (!this.model || !commandObject) return;

        const { base_action, turn_intensity } = commandObject;

        // --- 转向逻辑 (通常不检查碰撞，允许原地转向) ---
        if (base_action === 'FORWARD' && turn_intensity !== 0) {
            this.model.rotateY(this.turnSpeed * turn_intensity * deltaTime);
        }

        // --- 移动逻辑 (移动前检查碰撞) ---
        let displacement = 0;
        if (base_action === 'FORWARD') {
            displacement = this.moveSpeed * deltaTime;
        } else if (base_action === 'BACKWARD') {
            displacement = -this.moveSpeed * deltaTime;
        }

        if (displacement !== 0) {
            // 1. 计算位移向量
            const moveVector = new THREE.Vector3(0, 0, displacement);
            // 将位移向量从局部坐标系转换到世界坐标系
            moveVector.applyQuaternion(this.model.quaternion);

            // 2. 计算潜在的下一个位置
            const nextPosition = this.model.position.clone().add(moveVector);

            // 3. 检查下一个位置是否会发生碰撞
            if (!this.checkCollision(nextPosition, obstacles)) {
                // 如果没有碰撞，则实际移动
                this.model.position.copy(nextPosition);
            }
        }
        
        // 每次移动后更新边界框的位置
        if (this.model) {
             this.boundingBox.setFromObject(this.model);
        }
    }

    /**
     * 检查给定位置是否会与任何障碍物发生碰撞。
     * @param {THREE.Vector3} nextPosition - 机器人将要移动到的位置。
     * @param {Array} obstacles - 障碍物列表。
     * @returns {boolean} - 如果会发生碰撞，返回 true。
     */
    checkCollision(nextPosition, obstacles) {
        // 创建一个假设的边界框在下一个位置
        const hypotheticalBBox = this.boundingBox.clone();
        const offset = nextPosition.clone().sub(this.model.position);
        hypotheticalBBox.translate(offset);

        for (const obstacle of obstacles) {
            if (hypotheticalBBox.intersectsBox(obstacle.boundingBox)) {
                return true; // 发生碰撞！
            }
        }
        return false; // 没有碰撞
    }
}