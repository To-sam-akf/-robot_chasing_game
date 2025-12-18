# ThreadedCamera.py

import cv2
import threading
import time

class ThreadedCamera:
    """
    一个使用独立线程来持续读取摄像头帧的类，以解决OpenCV缓冲区的延迟问题。
    """
    def __init__(self, src=0):
        self.stream = cv2.VideoCapture(src)
        
        # --- 设置摄像头参数以获得高帧率 ---
        self.stream.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
        self.stream.set(cv2.CAP_PROP_FRAME_WIDTH, 480)
        self.stream.set(cv2.CAP_PROP_FRAME_HEIGHT, 360)
        self.stream.set(cv2.CAP_PROP_FPS, 30)

        (self.grabbed, self.frame) = self.stream.read()
        self.stopped = False
        
        # 打印最终应用的摄像头参数
        width = self.stream.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = self.stream.get(cv2.CAP_PROP_FRAME_HEIGHT)
        fps = self.stream.get(cv2.CAP_PROP_FPS)
        print(f"ThreadedCamera started with actual settings: {width}x{height} @ {fps} FPS")

    def start(self):
        # 启动一个线程来调用 update 方法
        thread = threading.Thread(target=self.update, args=())
        thread.daemon = True # 设置为守护线程，主程序退出时线程也退出
        thread.start()
        return self

    def update(self):
        # 线程的主循环
        while not self.stopped:
            # 从摄像头流中抓取下一帧
            (self.grabbed, self.frame) = self.stream.read()
            # 如果没有抓取到，说明流结束了
            if not self.grabbed:
                self.stop()
                return
            # 稍微暂停一下，避免CPU 100%
            time.sleep(0.001)

    def read(self):
        # 返回最新的一帧
        return self.frame

    def stop(self):
        # 标记线程应该停止
        self.stopped = True
        # 释放摄像头资源
        self.stream.release()