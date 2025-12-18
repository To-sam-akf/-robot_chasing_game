// js/TargetBot.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class TargetBot {
    constructor(scene, worldBounds = { x: 45, z: 45 }) {
        this.scene = scene;
        this.model = null;
        this.moveSpeed = 3.5; // 确保比玩家机器人慢
        this.worldBounds = worldBounds; // 限制活动范围

        // AI状态机
        this.state = 'waiting'; // 'waiting' or 'moving'
        this.decisionTimer = 0;

        this.boundingBox = new THREE.Box3(); // 也为AI机器人创建边界框
    }

    async load(path) {
        const loader = new GLTFLoader();
        try {
            const gltf = await loader.loadAsync(path);
            this.model = gltf.scene;
            
            // 为了区分，给AI机器人一个不同的颜色（例如红色）
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    // 创建一个新的、明亮的红色材质
                    const redMaterial = new THREE.MeshStandardMaterial({
                        color: 0xff0000, // 红色
                        emissive: 0x330000 // 加一点自发光，更显眼
                    });
                    child.material = redMaterial;
                }
            });
            this.scene.add(this.model);
            this.resetPosition(); // 初始随机位置
            console.log("TargetBot model loaded.");
        } catch (error) {
            console.error("An error happened while loading the TargetBot model:", error);
        }
        if (this.model) {
            this.boundingBox.setFromObject(this.model);
        }
    }

    /**
     * 更新AI机器人的状态和位置
     * @param {number} deltaTime 
     * @param {Array} obstacles - 障碍物列表
     */
    update(deltaTime, obstacles = []) {
        if (!this.model) return;

        this.decisionTimer -= deltaTime;
        if (this.decisionTimer <= 0) {
            this.makeDecision();
        }

        if (this.state === 'moving') {
            const displacement = this.moveSpeed * deltaTime;
            const moveVector = new THREE.Vector3(0, 0, displacement).applyQuaternion(this.model.quaternion);
            const nextPosition = this.model.position.clone().add(moveVector);
            
            // 检查世界边界和障碍物碰撞
            if (
                Math.abs(nextPosition.x) > this.worldBounds.x || 
                Math.abs(nextPosition.z) > this.worldBounds.z ||
                this.checkCollision(nextPosition, obstacles)
            ) {
                // // 如果碰到边界或障碍物，强制掉头
                // this.model.rotateY(Math.PI); // 掉头180度
                // this.state = 'waiting';
                // this.decisionTimer = 0.5; // 稍微停顿一下再做新决定
                this.model.position.copy(nextPosition);
            } else {
                // 没有碰撞，正常移动
                this.model.position.copy(nextPosition);
            }
        }
        
        if (this.model) {
            this.boundingBox.setFromObject(this.model);
        }
    }

    // 将碰撞检测逻辑从Robot.js复制过来 (或者您可以创建一个共同的基类)
    checkCollision(nextPosition, obstacles) {
        const hypotheticalBBox = this.boundingBox.clone();
        const offset = nextPosition.clone().sub(this.model.position);
        hypotheticalBBox.translate(offset);

        for (const obstacle of obstacles) {
            if (hypotheticalBBox.intersectsBox(obstacle.boundingBox)) {
                return true;
            }
        }
        return false;
    }

    /**
     * AI做决策：是继续等待还是开始移动
     */
    makeDecision() {
        if (this.state === 'waiting') {
            // 决定开始移动
            this.state = 'moving';
            // 随机一个移动时长 (1到3秒)
            this.decisionTimer = Math.random() * 2 + 1;
            // 随机转向一个新方向
            this.model.rotation.y = Math.random() * Math.PI * 2;
        } else {
            // 决定开始等待
            this.state = 'waiting';
            // 随机一个等待时长 (0.5到2.5秒)
            this.decisionTimer = Math.random() * 2 + 0.5;
        }
    }

    /**
     * 将机器人重置到一个新的随机位置
     */
    resetPosition() {
        if (!this.model) return;
        const x = (Math.random() - 0.5) * this.worldBounds.x * 2;
        const z = (Math.random() - 0.5) * this.worldBounds.z * 2;
        this.model.position.set(x, 0, z);
        this.state = 'waiting';
        this.decisionTimer = 1; // 被抓后等待1秒再开始移动
    }
}