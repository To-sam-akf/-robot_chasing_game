# config.py

# --- WebSocket Server Configuration ---
# 监听的IP地址。'0.0.0.0' 表示监听所有可用的网络接口。
# 这意味着同一局域网内的任何设备都可以连接。
SERVER_HOST = '0.0.0.0'

# 监听的端口号。
SERVER_PORT = 8765

# --- Camera Configuration ---
# 摄像头的设备索引。0 通常代表系统默认的第一个摄像头。
CAMERA_INDEX = 0

# --- Gesture Recognition Configuration ---
# MediaPipe手势识别的最小检测置信度。
# 只有当检测到的手势置信度高于此值时，才被认为是有效的。
MIN_DETECTION_CONFIDENCE = 0.7

# MediaPipe手势跟踪的最小置信度。
# 在连续的视频帧中跟踪手势时，只有当跟踪的置信度高于此值时，才被认为是有效的。
MIN_TRACKING_CONFIDENCE = 0.5