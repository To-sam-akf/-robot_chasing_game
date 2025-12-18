// js/CameraFollow.js

import * as THREE from 'three';

export class CameraFollowController {
    /**
     * @param {THREE.PerspectiveCamera} camera 要控制的摄像机
     * @param {THREE.Object3D} target 要跟随的目标 (机器人模型)
     */
    constructor(camera, target) {
        this.camera = camera;
        this.target = target;

        // --- 可调整的参数 ---
        
        // 1. 摄像机相对于目标的理想偏移量 (在目标的局部坐标系中)
        // x: 0 = 在正后方
        // y: 正数 = 在上方
        // z: 正数 = 在后方
        this.idealOffset = new THREE.Vector3(0, 4, -8);

        // 2. 摄像机看向的目标点相对于目标中心的偏移量
        // y: 1.5 表示看向比机器人中心高 1.5 个单位的点，这样视线更平稳
        this.lookAtOffset = new THREE.Vector3(0, 1.5, 0);

        // 3. 平滑系数。值越大，摄像机跟随越快、越“硬”；值越小，跟随越慢、越“柔和”
        this.smoothingFactor = 4.0; 
    }

    /**
     * 在每一帧中更新摄像机的位置和朝向。
     * @param {number} deltaTime 自上一帧以来的时间（秒）。
     */
    update(deltaTime) {
        if (!this.target) return;

        // 1. 计算摄像机的理想世界坐标
        // 首先，复制理想偏移量，然后将其从目标的局部坐标系转换到世界坐标系
        const idealPosition = this.idealOffset.clone();
        idealPosition.applyMatrix4(this.target.matrixWorld);

        // 2. 计算摄像机应该看向的世界坐标
        const lookAtPosition = this.lookAtOffset.clone();
        lookAtPosition.applyMatrix4(this.target.matrixWorld);

        // 3. 使用lerp（线性插值）平滑地移动摄像机到理想位置
        // 这可以防止摄像机因目标的突然移动或旋转而产生抖动
        const t = this.smoothingFactor * deltaTime;
        this.camera.position.lerp(idealPosition, t);

        // 4. 始终将摄像机朝向计算出的目标观察点
        this.camera.lookAt(lookAtPosition);
    }
}