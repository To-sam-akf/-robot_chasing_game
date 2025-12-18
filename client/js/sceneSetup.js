// js/sceneSetup.js

import * as THREE from 'three';

// 导出将要用到的变量
export let scene, camera, renderer;

export function initScene(container) {
    // 1. 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb); // 天蓝色背景
    scene.fog = new THREE.Fog(0x87ceeb, 1, 50);

    // 2. 创建相机
    camera = new THREE.PerspectiveCamera(
        75, // 视野角度 (FOV)
        window.innerWidth / window.innerHeight, // 宽高比
        0.1, // 近裁剪面
        1000 // 远裁剪面
    );
    camera.position.set(0, 5, 15); // 将相机向后移动并抬高
    // camera.lookAt(0, 0, 0);

    // 3. 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true; // 开启阴影
    container.appendChild(renderer.domElement);

    // 4. 添加灯光
    // 环境光，提供基础照明
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // 平行光，模拟太阳光，可以产生阴影
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // --- 新增：使用 GridHelper 创建黑白网格地面 ---
    
    const size = 300; // 网格的总尺寸 (300x300)
    const divisions = 100; // 网格的分割数量 (沿每个轴分割成100份)
    const colorCenterLine = 0x888888; // 中心线的颜色 (灰色)
    const colorGrid = 0x444444;       // 普通网格线的颜色 (深灰色)

    const gridHelper = new THREE.GridHelper(size, divisions, colorCenterLine, colorGrid);
    
    // GridHelper 默认是水平的，不需要旋转
    scene.add(gridHelper);

    // --- (可选) 添加一个不可见的接收阴影的平面 ---
    // GridHelper 本身不接收阴影，如果希望地面能显示机器人投下的影子，
    // 我们需要在 GridHelper 的同一位置放一个透明的平面来专门接收阴影。
    const shadowPlaneGeometry = new THREE.PlaneGeometry(size, size);
    const shadowPlaneMaterial = new THREE.ShadowMaterial(); // 一种只接收阴影的特殊材质
    shadowPlaneMaterial.opacity = 0.3; // 调整阴影的深浅
    
    const shadowPlane = new THREE.Mesh(shadowPlaneGeometry, shadowPlaneMaterial);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.receiveShadow = true;
    // 将其稍微下移一点点，避免与网格线发生Z-fighting（闪烁）
    shadowPlane.position.y = -0.01; 
    scene.add(shadowPlane);

    // 6. 监听窗口大小变化
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}