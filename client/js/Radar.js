// js/Radar.js

import * as THREE from 'three';

export class Radar {
    /**
     * @param {HTMLCanvasElement} canvas - The canvas element to draw on.
     * @param {THREE.Object3D} player - The player's 3D model.
     * @param {THREE.Object3D} target - The target's 3D model.
     * @param {number} maxDistance - The maximum 3D distance the radar can 'see'.
     */
    constructor(canvas, player, target, maxDistance = 50) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.player = player;
        this.target = target;
        this.maxDistance = maxDistance;

        // 雷达画布的尺寸和中心点
        this.size = canvas.width;
        this.center = this.size / 2;
        this.dotRadius = 3; // 雷达上点的大小
    }

    update() {
        if (!this.player || !this.target) return;

        // 1. 清除上一帧的画布
        this.ctx.clearRect(0, 0, this.size, this.size);

        // 2. 绘制雷达背景和网格
        this.drawGrid();

        // 3. 绘制代表玩家的中心点 (或三角形)
        this.drawPlayer();

        // 4. 计算并绘制目标点
        this.drawTarget();
    }
    
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        this.ctx.lineWidth = 1;

        // 绘制十字线
        this.ctx.beginPath();
        this.ctx.moveTo(this.center, 0);
        this.ctx.lineTo(this.center, this.size);
        this.ctx.moveTo(0, this.center);
        this.ctx.lineTo(this.size, this.center);
        this.ctx.stroke();

        // 绘制同心圆
        this.ctx.beginPath();
        this.ctx.arc(this.center, this.center, this.center * 0.8, 0, 2 * Math.PI);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(this.center, this.center, this.center * 0.5, 0, 2 * Math.PI);
        this.ctx.stroke();
    }
    
    drawPlayer() {
        // 绘制一个指向前方的绿色小三角形代表玩家
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
        this.ctx.beginPath();
        this.ctx.moveTo(this.center, this.center - 5);
        this.ctx.lineTo(this.center - 4, this.center + 4);
        this.ctx.lineTo(this.center + 4, this.center + 4);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawTarget() {
        // --- 核心逻辑：将3D世界坐标转换为2D雷达坐标 ---

        // a. 获取从玩家到目标的向量
        const relativePos = this.target.position.clone().sub(this.player.position);

        // b. 将该向量旋转到玩家的局部坐标系中
        //    这能让雷达始终以玩家的“前方”为“上方”
        const playerInverseQuaternion = this.player.quaternion.clone().invert();
        relativePos.applyQuaternion(playerInverseQuaternion);

        // c. 计算目标在XZ平面上的距离和角度
        const distance = Math.sqrt(relativePos.x * relativePos.x + relativePos.z * relativePos.z);
        
        // d. 将3D距离映射到雷达半径上
        let radarDist = (distance / this.maxDistance) * (this.center - this.dotRadius);
        
        // e. 如果目标超出雷达范围，则将其固定在边缘
        if (radarDist > this.center - this.dotRadius) {
            radarDist = this.center - this.dotRadius - 2; // 留一点边距
        }
        
        // f. 雷达的X是3D的X，雷达的Y是3D的-Z (因为Z轴向前，而画布Y轴向下)
        const radarX = this.center - (relativePos.x / this.maxDistance) * (this.center - this.dotRadius);
        const radarY = this.center - (relativePos.z / this.maxDistance) * (this.center - this.dotRadius);
        
        // g. 再次确保点不会画出圈外
        const dx = radarX - this.center;
        const dy = radarY - this.center;
        const distFromCenter = Math.sqrt(dx*dx + dy*dy);
        
        let finalX = radarX;
        let finalY = radarY;
        if(distFromCenter > this.center - this.dotRadius - 2) {
             const angle = Math.atan2(dy, dx);
             finalX = this.center + Math.cos(angle) * (this.center - this.dotRadius - 2);
             finalY = this.center + Math.sin(angle) * (this.center - this.dotRadius - 2);
        }

        // h. 绘制目标点
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.9)'; // 红色
        this.ctx.beginPath();
        this.ctx.arc(finalX, finalY, this.dotRadius, 0, 2 * Math.PI);
        this.ctx.fill();
    }
}