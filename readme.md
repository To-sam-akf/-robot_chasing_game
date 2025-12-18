
---

# 手势追踪3D机器人竞技场 (Gesture-Controlled 3D Robot Arena)


这是一个结合了嵌入式AI、计算机视觉与Web 3D技术的交互式游戏项目。玩家通过在**Atlas开发板**的摄像头前做出手势，实时操控PC浏览器中3D场景里的机器人，在一个布满障碍物的竞技场中，追逐并捕捉一个自主移动的AI机器人。

## 核心功能

- **实时手势识别**: 基于Google的MediaPipe框架，在Atlas开发板上实现低延迟、高精度的手部关键点检测。
- **平滑的3D操控**: 创新的手势指令系统，不仅能控制前进后退，还能通过手掌倾斜角度实现**无级变速的平滑转向**。
- **分布式架构**: 计算密集型的手势识别任务在Atlas开发板上运行，图形密集型的3D渲染任务在PC浏览器中运行，二者通过WebSocket解耦，最大化利用硬件性能。
- **完整的游戏机制**:
    - **追逐与捕捉**: 玩家需在倒计时结束前追上AI机器人。
    - **动态难度**: 每成功捕捉一次，分数增加，但下一轮的倒计时会缩短。
    - **随机动态环境**: 每次游戏开始时，都会在地图上随机生成障碍物，机器人需要绕行。
- **丰富的交互式UI**:
    - **游戏HUD**: 实时显示得分与剩余时间。
    - **战术雷达**: 左下角雷达图清晰指示目标AI相对于玩家的方位。
    - **游戏结束与重启**: 完善的结束画面和一键重新开始功能。

## 技术架构

本项目的核心是“端云协同”的分布式架构，将计算与渲染分离：

![技术架构图](assets/architecture.png)

```mermaid
graph TD
    subgraph Atlas开发板 (计算端/服务端)
        A[摄像头] --> B{Python应用: main.py};
        B --> C[OpenCV: 图像采集与预处理];
        C --> D[MediaPipe: 手势关键点检测];
        D --> E[GestureRecognizer.py: 手势解析与指令生成];
        E --> F[WebSocket Server: 广播指令];
    end

    subgraph 本地PC (渲染端/客户端)
        I[浏览器] --> J{JavaScript应用};
        J --> K[Three.js: 3D场景渲染];
        K --> L[Robot.js: 玩家机器人];
        K --> M[TargetBot.js: AI机器人];
        K --> N[ObstacleManager.js: 障碍物];
        O[WebSocket Client] --> J;
        J --> P[Radar.js: 雷达UI];
        J --> Q[HTML/CSS: 游戏HUD];
    end

    F -- JSON指令 (低延迟) --> O;

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style I fill:#ccf,stroke:#333,stroke-width:2px
```

### 工作原理

1.  **数据采集 (Atlas端)**: `main.py` 通过OpenCV持续从USB摄像头捕获视频帧，并进行水平翻转以形成直观的“镜面”视图。
2.  **手势识别 (Atlas端)**: `GestureRecognizer.py` 接收每一帧图像，利用MediaPipe Hands模型快速识别出21个手部关键点。
3.  **指令生成 (Atlas端)**: 通过分析手指的伸展状态（前进/后退/停止）和手掌从手腕到指根的方向向量（平滑转向），生成包含`base_action`和`turn_intensity`的JSON指令。此过程包含了**防抖**和**EMA指数移动平均平滑**算法，以确保控制的稳定性。
4.  **指令广播 (Atlas端)**: Python `websockets`库将生成的JSON指令通过WebSocket协议实时广播到局域网。
5.  **指令接收 (PC端)**: 浏览器中的`WebSocketClient.js`监听并接收指令。
6.  **游戏状态更新 (PC端)**: `main.js`在`animate`动画循环中，将接收到的最新指令传递给玩家机器人(`PlayerBot.js`)。
7.  **物理与逻辑处理 (PC端)**:
    - 玩家和AI机器人在其`update`方法中，根据指令或AI逻辑计算下一步的潜在位置。
    - 在移动前，会调用**AABB碰撞检测**算法，检查是否会与`ObstacleManager.js`管理的任何障碍物发生碰撞。如果会，则取消本次移动。
    - 游戏主循环同时检测玩家与AI的距离，判定是否“捕捉”成功，并更新分数和计时器。
8.  **场景渲染 (PC端)**: Three.js根据所有物体（机器人、障碍物）的最新位置和姿态，渲染出完整的3D场景。同时，`Radar.js`在`<canvas>`上绘制2D雷达图。

## 关键代码片段

### 1. 手势识别核心逻辑 (Python)

这是将手部关键点转换为平滑转向指令的核心算法。它通过计算手掌的角度，并使用`np.interp`进行线性插值，将角度映射到`[-1.0, 1.0]`的转向强度。

```python
# GestureRecognizer.py -> _interpret_gesture()

def _interpret_gesture(self, hand_landmarks):
    # ... (手指伸展状态判断, 决定 base_action)
    
    # 角度与转向强度（仅 FORWARD 时计算）
    turn_intensity = 0.0
    angle_deg = 0.0
    if base_action == "FORWARD":
        # 获取手掌相对于图像水平线的角度
        angle_deg = self._get_hand_angle(lm)

        # 定义中立区、左转区和右转区的角度阈值
        NEUTRAL_MIN = -100.0
        NEUTRAL_MAX = -80.0
        MAX_LEFT = -160.0
        MAX_RIGHT = -20.0

        # 左侧（角度更小数值更负）
        if angle_deg < NEUTRAL_MIN:
            # 将角度线性映射到 [-1.0, 0.0] 的转向强度
            turn_intensity = np.interp(angle_deg, [MAX_LEFT, NEUTRAL_MIN], [-1.0, 0.0])
        # 右侧
        elif angle_deg > NEUTRAL_MAX:
            # 将角度线性映射到 [0.0, 1.0] 的转向强度
            turn_intensity = np.interp(angle_deg, [NEUTRAL_MAX, MAX_RIGHT], [0.0, 1.0])

    return {
        "base_action": base_action,
        "turn_intensity": float(turn_intensity),
        # ...
    }
```

### 2. 机器人运动与碰撞检测 (JavaScript)

这是玩家机器人的`update`方法，展示了如何应用指令，并在移动前进行碰撞检测。

```javascript
// js/Robot.js -> update()

update(deltaTime, commandObject, obstacles = []) {
    if (!this.model || !commandObject) return;

    const { base_action, turn_intensity } = commandObject;

    // 1. 应用转向 (原地转向)
    if (base_action === 'FORWARD' && turn_intensity !== 0) {
        // 将 [-1.0, 1.0] 的强度转换为实际旋转角度
        this.model.rotateY(-this.turnSpeed * turn_intensity * deltaTime);
    }

    // 2. 计算位移
    let displacement = 0;
    if (base_action === 'FORWARD') {
        displacement = this.moveSpeed * deltaTime;
    } else if (base_action === 'BACKWARD') {
        displacement = -this.moveSpeed * deltaTime;
    }

    if (displacement !== 0) {
        // 3. 计算潜在的下一个位置
        const moveVector = new THREE.Vector3(0, 0, displacement);
        moveVector.applyQuaternion(this.model.quaternion);
        const nextPosition = this.model.position.clone().add(moveVector);

        // 4. 碰撞检测
        if (!this.checkCollision(nextPosition, obstacles)) {
            // 如果没有碰撞，则执行移动
            this.model.position.copy(nextPosition);
        }
    }
    
    // 每次移动后更新自身的边界框
    this.boundingBox.setFromObject(this.model);
}
```

### 3. 游戏主循环 (JavaScript)

`animate`函数是整个客户端的“心跳”，它在每一帧驱动游戏逻辑的更新和画面的重绘。

```javascript
// js/main.js -> animate()

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    
    if (gameState === 'PLAYING') {
        const obstacles = obstacleManager.getObstacles();

        // 更新机器人（传入障碍物列表用于碰撞检测）
        playerBot.update(deltaTime, currentCommand, obstacles);
        targetBot.update(deltaTime, obstacles);
        
        // 更新游戏逻辑
        timeLeft -= deltaTime;
        if (timeLeft <= 0) { /* ... gameOver() ... */ }
        timerDisplay.textContent = timeLeft.toFixed(1);
        checkCatchCollision();
    }
    
    // 无论游戏状态如何，始终更新摄像头和雷达
    if (cameraController) {
        cameraController.update(deltaTime);
    }
    if (radar) {
        radar.update();
    }

    // 渲染3D场景
    renderer.render(scene, camera);
}
```

## 技术栈

- **硬件**:
    - Atlas 200 DK (或类似基于昇腾芯片的开发板)
    - 普通USB摄像头
- **服务端 (Atlas开发板)**:
    - **Python 3**: 主程序语言
    - **OpenCV**: 摄像头视频流处理
    - **MediaPipe**: 实时手势识别模型
    - **websockets**: 实现WebSocket服务器
    - **NumPy**: 科学计算，用于插值
- **客户端 (本地PC)**:
    - **HTML5 / CSS3**: 构建游戏界面和UI
    - **JavaScript (ES6 Modules)**: 驱动所有前端逻辑
    - **Three.js**: 强大的WebGL 3D渲染库

## 如何运行

### 环境准备

1.  **Atlas开发板端**:
    - 确保已安装Python 3环境。
    - 克隆本项目仓库。
    - 安装所有Python依赖：`pip install -r requirements.txt` (您需要创建一个包含`opencv-python`, `mediapipe`, `websockets`, `numpy`的`requirements.txt`文件)。
2.  **本地PC端**:
    - 安装一个现代浏览器（如 Chrome 或 Firefox）。
    - 推荐安装 Visual Studio Code 及 `Live Server` 插件，以便轻松启动本地web服务器。

### 启动步骤

1.  **启动服务端 (Atlas开发板)**:
    - 通过SSH连接到您的Atlas开发板。
    - 进入项目目录。
    - 使用 `ifconfig` 或 `ip addr` 命令查找并记下开发板的局域网IP地址 (例如 `192.168.1.108`)。
    - 运行主程序：`python main.py`。
    - 如果连接了显示器，您将看到带标注的摄像头画面。

2.  **启动客户端 (本地PC)**:
    - 在PC上，使用VS Code打开项目文件夹。
    - **[关键一步]** 打开 `js/main.js` 文件，找到 `ATLAS_BOARD_IP` 常量，将其值修改为您刚刚记下的开发板IP地址。
    - 在 `index.html` 文件上右键，选择 "Open with Live Server"。
    - 浏览器将自动打开游戏页面。

3.  **开始游戏!**
    - 页面加载完成后，游戏将自动开始。在摄像头前做出手势，开始您的追逐之旅吧！
