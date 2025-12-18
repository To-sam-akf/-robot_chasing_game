# main.py

import cv2
import asyncio
import json
import config
from gesture_recognizer import GestureRecognizer
from websocket_server import WebSocketServer
from ThreadedCamera import ThreadedCamera # <-- 1. 引入新类

async def main():
    """
    主异步函数，运行整个应用。
    """
    # 1. 初始化WebSocket服务器 (不变)
    ws_server = WebSocketServer(config.SERVER_HOST, config.SERVER_PORT)
    server = await websockets.serve(ws_server._register, config.SERVER_HOST, config.SERVER_PORT)
    print(f"WebSocket server started on ws://{config.SERVER_HOST}:{config.SERVER_PORT}")
    broadcast_task = asyncio.create_task(ws_server._broadcast_messages())

    # 2. 初始化手势识别器 (不变)
    recognizer = GestureRecognizer(
        min_detection_confidence=config.MIN_DETECTION_CONFIDENCE,
        min_tracking_confidence=config.MIN_TRACKING_CONFIDENCE
    )

    # --- 3. 修改：初始化并启动线程化的摄像头 ---
    print("Starting threaded camera...")
    threaded_cam = ThreadedCamera(src=config.CAMERA_INDEX).start()
    await asyncio.sleep(2) # 给摄像头一点时间来稳定启动

    print("Camera and Gesture Recognizer initialized. Starting main loop...")
    
    try:
        while True: # 使用一个更简单的循环
            # 从线程化读取器中获取最新的一帧
            frame = threaded_cam.read()
            if frame is None:
                print("Could not read frame from camera thread. Exiting.")
                break
            # frame = cv2.flip(frame, 1)

            # 进行手势识别
            annotated_frame, gesture_cmd = recognizer.recognize(frame)

            # 将识别到的指令放入WebSocket服务器的发送队列
            if gesture_cmd:
                ws_server.queue_message(gesture_cmd) # 注意: gesture_recognizer现在返回的是dict
                
            # (可选) 在开发板上显示带标注的视频流，用于调试
            # 注意：如果开发板没有连接显示器，请注释掉此行
            cv2.imshow('Gesture Controller - Atlas', annotated_frame)

            # 按'q'键退出
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
            # 允许asyncio事件循环处理其他任务
            await asyncio.sleep(0.01)

    finally:
        # 清理资源
        print("Cleaning up resources...")
        threaded_cam.stop() # <-- 4. 停止摄像头线程
        cv2.destroyAllWindows()
        recognizer.close()
        broadcast_task.cancel()
        server.close()
        await server.wait_closed()
        print("Cleanup complete. Exiting.")

if __name__ == "__main__":
    try:
        # 确保在使用websockets时正确导入
        import websockets 
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Program interrupted by user.")
