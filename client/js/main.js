// js/main.js

import * as THREE from 'three';
import { initScene, scene, camera, renderer } from './sceneSetup.js';
import { Robot } from './Robot.js';
import { TargetBot } from './TargetBot.js'; // 引入AI机器人
import { WebSocketClient } from './WebSocketClient.js';
import { CameraFollowController } from './CameraFollow.js';
import { Radar } from './Radar.js'; // <-- 1. 引入雷达类
import { ObstacleManager } from './ObstacleManager.js'; // 1. 引入新类

// --- 配置 ---
const OBSTACLE_MODEL_PATHS = {
    // boobs:"./assets/temari_from_naruto.glb",
    tree: './assets/sam.glb'
    // 示例：您的模型路径
    // rock: './assets/rock.glb'
};
const OBSTACLE_COUNT = 20; // 您想生成的障碍物数量
// ... (IP地址等配置保持不变) ...
const PLAYER_MODEL_PATH = './assets/robot.glb';
const TARGET_MODEL_PATH = './assets/robot.glb'; // 复用同一个模型，但会改变颜色
// --- 配置 (保持不变) ---
const ATLAS_BOARD_IP = '192.168.137.2'; 
const WEBSOCKET_URL = `ws://${ATLAS_BOARD_IP}:8765`;
const ROBOT_MODEL_PATH = './assets/robot.glb';
const LANDMARK_POSITION = new THREE.Vector3(10, 0.1, -5);
const LANDMARK_RADIUS = 2; 

// --- 游戏规则配置 ---
const INITIAL_TIME_LIMIT = 60;  // 初始倒计时
const TIME_REDUCTION_PER_CATCH = 7;  // 每次抓到后减少的时间
const MINIMUM_TIME_LIMIT = 5.0;   // 倒计时的最短时间
const CATCH_RADIUS = 2.5;         // 判定为“抓到”的距离

// --- 全局游戏状态变量 ---
let playerBot, targetBot, cameraController, radar, obstacleManager;
let score, timeLeft, currentRoundTimeLimit;
let gameState = 'LOADING'; // 'LOADING', 'PLAYING', 'GAME_OVER'
let currentCommand = { base_action: 'STOP', turn_intensity: 0.0 };
const clock = new THREE.Clock(); 

// --- DOM元素引用 ---
const radarCanvas = document.getElementById('radar-canvas'); // <-- 3. 获取雷达画布
const scoreDisplay = document.getElementById('score-display');
const timerDisplay = document.getElementById('timer-display');
const commandDisplay = document.getElementById('command-display');
const connectionStatusDisplay = document.getElementById('connection-status');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreDisplay = document.getElementById('final-score-display');
const restartButton = document.getElementById('restart-button');

/**
 * 主初始化函数
 */
async function init() {
    const container = document.getElementById('scene-container');
    initScene(container);

    // 3. 初始化障碍物管理器并加载模型
    obstacleManager = new ObstacleManager(scene);
    await obstacleManager.loadModels(OBSTACLE_MODEL_PATHS);

    // 并行加载模型
    playerBot = new Robot(scene);
    targetBot = new TargetBot(scene);
    await Promise.all([
        playerBot.load(PLAYER_MODEL_PATH),
        targetBot.load(TARGET_MODEL_PATH)
    ]);

    // 初始化摄像机跟随
    if (playerBot.model) {
        cameraController = new CameraFollowController(camera, playerBot.model);
    }

    // <-- 4. 初始化雷达 -->
    if (playerBot.model && targetBot.model) {
        radar = new Radar(radarCanvas, playerBot.model, targetBot.model);
    }
    
    // 连接WebSocket
    const wsClient = new WebSocketClient();
    wsClient.onMessage((gestureObject) => {
        if (gameState !== 'PLAYING') return;
        currentCommand = gestureObject;
        const action = gestureObject.base_action || 'N/A';
        const intensity = (gestureObject.turn_intensity || 0.0).toFixed(2);
        commandDisplay.textContent = `Action: ${action}, Turn: ${intensity}`;
    });
    wsClient.onStatusChange((status) => { connectionStatusDisplay.textContent = status; });
    wsClient.connect(WEBSOCKET_URL);
    
    // 绑定重启按钮事件
    restartButton.addEventListener('click', startGame);

    // 启动游戏
    startGame();
    animate();
}

/**
 * 开始或重置游戏
 */
function startGame() {
    console.log("Starting game...");
    score = 0;
    currentRoundTimeLimit = INITIAL_TIME_LIMIT;
    timeLeft = currentRoundTimeLimit;
    
    scoreDisplay.textContent = score;
    timerDisplay.textContent = timeLeft.toFixed(1);

    // 重置机器人位置
    if (playerBot.model) playerBot.model.position.set(0, 0, 5);
    if (targetBot) targetBot.resetPosition();

    if (obstacleManager && playerBot.model && targetBot.model) {
        obstacleManager.generateObstacles(OBSTACLE_COUNT, [
            { object: playerBot.model, radius: 8 }, // 玩家出生点安全区
            { object: targetBot.model, radius: 8 }  // AI出生点安全区
        ]);
    }
    
    // 切换状态
    gameState = 'PLAYING';
    gameOverScreen.style.display = 'none';
}

/**
 * 当抓到目标时调用
 */
function onCatchTarget() {
    score++;
    scoreDisplay.textContent = score;

    // 缩短下一轮的时间，但不能低于最小值
    currentRoundTimeLimit = Math.max(
        MINIMUM_TIME_LIMIT,
        currentRoundTimeLimit - TIME_REDUCTION_PER_CATCH
    );
    timeLeft = currentRoundTimeLimit;

    // 重置目标位置
    targetBot.resetPosition();
}

/**

 * 游戏结束
 */
function gameOver() {
    gameState = 'GAME_OVER';
    finalScoreDisplay.textContent = score;
    gameOverScreen.style.display = 'flex';
}

/**
 * 检测玩家是否抓到目标
 */
function checkCatchCollision() {
    if (!playerBot.model || !targetBot.model) return;

    const distance = playerBot.model.position.distanceTo(targetBot.model.position);
    if (distance < CATCH_RADIUS) {
        onCatchTarget();
    }
}


/**
 * 动画循环 (游戏主循环)
 */
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    
    // 只有在游戏中才更新逻辑
    if (gameState === 'PLAYING') {
        const obstacles = obstacleManager.getObstacles();

        // 5. 将障碍物列表传递给机器人的update方法
        playerBot.update(deltaTime, currentCommand, obstacles);
        targetBot.update(deltaTime, obstacles);

        // 更新倒计时
        timeLeft -= deltaTime;
        if (timeLeft <= 0) {
            timeLeft = 0;
            gameOver();
        }
        timerDisplay.textContent = timeLeft.toFixed(1);

        // 更新机器人
        playerBot.update(deltaTime, currentCommand);
        targetBot.update(deltaTime);

        // 检测捕捉
        checkCatchCollision();
    }
    
    // 摄像机和渲染始终更新
     // --- 5. 始终更新雷达和摄像机 ---
     if (cameraController) {
        cameraController.update(deltaTime);
    }
    if (radar) {
        radar.update(); // <-- 在每一帧更新雷达画面
    }
    renderer.render(scene, camera);
}

// --- 启动应用 ---
init();