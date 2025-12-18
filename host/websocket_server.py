# websocket_server.py

import asyncio
import websockets
import json
from collections import deque

class WebSocketServer:
    """
    一个封装了WebSocket服务器功能的类，用于广播消息。
    """
    def __init__(self, host, port):
        """
        初始化WebSocket服务器。

        参数:
            host (str): 服务器绑定的IP地址。
            port (int): 服务器监听的端口。
        """
        self.host = host
        self.port = port
        self.connected_clients = set()
        self.message_queue = asyncio.Queue()

    async def _register(self, websocket):
        """
        当有新客户端连接时，注册该客户端。
        """
        self.connected_clients.add(websocket)
        print(f"New client connected. Total clients: {len(self.connected_clients)}")
        try:
            # 保持连接打开，直到客户端断开
            await websocket.wait_closed()
        finally:
            self._unregister(websocket)

    def _unregister(self, websocket):
        """
        当客户端断开连接时，注销该客户端。
        """
        self.connected_clients.remove(websocket)
        print(f"Client disconnected. Total clients: {len(self.connected_clients)}")
    
    async def _broadcast_messages(self):
        """
        一个持续运行的任务，从队列中获取消息并广播给所有客户端。
        """
        while True:
            # 从队列中异步等待消息
            message = await self.message_queue.get()
            if self.connected_clients:
                # 使用asyncio.gather并发地向所有客户端发送消息
                await asyncio.gather(
                    *[client.send(message) for client in self.connected_clients],
                    return_exceptions=True  # 忽略发送失败的异常（例如客户端已断开但尚未注销）
                )
    
    def queue_message(self, gesture_command):
        """
        将要发送的消息放入队列。
        这是一个非阻塞方法，可以从主循环中安全调用。

        参数:
            gesture_command (str): 手势指令字符串。
        """
        # 封装成JSON格式
        message = json.dumps({"gesture": gesture_command})
        try:
            # put_nowait 是非阻塞的
            self.message_queue.put_nowait(message)
        except asyncio.QueueFull:
            # 如果队列满了，可以选择忽略或者记录日志
            print("WebSocket message queue is full. Skipping message.")

    async def start(self):
        """
        启动WebSocket服务器和消息广播任务。
        """
        print(f"Starting WebSocket server on ws://{self.host}:{self.port}...")
        # 创建一个在后台运行的消息广播任务
        asyncio.create_task(self._broadcast_messages())
        
        # 启动WebSocket服务器，为每个连接调用_register方法
        server = await websockets.serve(self._register, self.host, self.port)
        
        # 等待服务器关闭（在这个应用中，它会一直运行）
        await server.wait_closed()