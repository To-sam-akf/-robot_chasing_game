# 改进版 GestureRecognizer.py
import cv2
import mediapipe as mp
import numpy as np
import math
import time
from collections import deque

class GestureRecognizer:
    def __init__(self,
                 min_detection_confidence=0.7,
                 min_tracking_confidence=0.5,
                 ema_alpha=0.3,               # 平滑系数（turn_intensity）
                 action_confirm_frames=3,      # 连续帧确认为某动作才切换
                 no_hand_stop_frames=2):       # 丢手几帧直接 STOP（容忍短丢帧）
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            model_complexity=0,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence
        )
        self.mp_drawing = mp.solutions.drawing_utils

        # --- 优化 2：性能分析变量 ---
        self.processing_time = 0.0

        # 平滑 & 防抖参数
        self.ema_alpha = ema_alpha
        self.turn_ema = None
        self.action_history = deque(maxlen=action_confirm_frames)
        self.frames_since_nohand = 0
        self.no_hand_stop_frames = no_hand_stop_frames
        self.action_confirm_frames = action_confirm_frames

        # 保存上一个最终输出（用于短时无手容错）
        self.current_output = self._get_stop_command()

    def _get_stop_command(self):
        return {
            "base_action": "STOP",
            "turn_intensity": 0.0,
            "angle_debug": 0.0,
            "timestamp": time.time()
        }

    def close(self):
        self.hands.close()

    # 辅助：欧氏距离（landmark是x,y,z）
    def _dist(self, a, b):
        dx = a.x - b.x
        dy = a.y - b.y
        return math.hypot(dx, dy)

    # 更稳健的“手指是否伸出”判定：tip 距离 wrist 是否明显大于 pip 距离 wrist
    def _finger_is_up(self, landmarks, tip_idx, pip_idx, wrist_idx, threshold_factor=1.03):
        tip = landmarks[tip_idx]
        pip = landmarks[pip_idx]
        wrist = landmarks[wrist_idx]
        d_tip = self._dist(tip, wrist)
        d_pip = self._dist(pip, wrist)
        return d_tip > d_pip * threshold_factor

    # 手掌方向角（从 wrist 指向 middle_mcp），返回度数 -180..180
    def _get_hand_angle(self, landmarks):
        p1 = landmarks[self.mp_hands.HandLandmark.WRIST]
        p2 = landmarks[self.mp_hands.HandLandmark.MIDDLE_FINGER_MCP]
        angle_rad = math.atan2(p2.y - p1.y, p2.x - p1.x)
        return math.degrees(angle_rad)

    # 将 raw_turn 做 EMA 平滑
    def _smooth_turn(self, raw_turn):
        if self.turn_ema is None:
            self.turn_ema = raw_turn
        else:
            self.turn_ema = self.ema_alpha * raw_turn + (1.0 - self.ema_alpha) * self.turn_ema
        return self.turn_ema

    # 主识别函数（接收 BGR 图像, 返回画上调试信息的图像 和 command dict）
    def recognize(self, image):
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        image_rgb.flags.writeable = False

        # --- 优化 2：开始计时 ---
        start_time = time.time()
        results = self.hands.process(image_rgb)
        self.processing_time = (time.time() - start_time) * 1000 # 转换为毫秒
        
        image.flags.writeable = True

        # 如果完全没检测到手，使用短时容错：只有连续 no_hand_stop_frames 帧才真正 STOP
        if not results.multi_hand_landmarks:
            self.frames_since_nohand += 1
            if self.frames_since_nohand >= self.no_hand_stop_frames:
                # 重置平滑状态
                self.turn_ema = None
                self.action_history.clear()
                self.current_output = self._get_stop_command()
            # 还是返回当前（可能是之前的状态）以避免单帧抖动
            self._draw_debug(image, self.current_output, note=f"NO_HAND (count={self.frames_since_nohand})")
            return image, self.current_output

        # 有手则重置无手计数
        self.frames_since_nohand = 0

        hand_landmarks = results.multi_hand_landmarks[0]
        self.mp_drawing.draw_landmarks(image, hand_landmarks, self.mp_hands.HAND_CONNECTIONS)

        cmd = self._interpret_gesture(hand_landmarks)
        # 防抖：将 base_action 推入 history，只有 history 全部一致时才真正切换
        self.action_history.append(cmd["base_action"])
        if len(self.action_history) == self.action_history.maxlen and len(set(self.action_history)) == 1:
            final_action = self.action_history[-1]
        else:
            # 若未达到确认帧数，则保留上一次最终输出的 base_action（延迟切换）
            final_action = self.current_output["base_action"]

        # turn_intensity 平滑（只有当 base_action == FORWARD 才给转向非零）
        if final_action == "FORWARD":
            smoothed_turn = self._smooth_turn(cmd["turn_intensity"])
        else:
            # 非前进时把 turn 归零并重置 EMA
            smoothed_turn = 0.0
            self.turn_ema = None

        output = {
            "base_action": final_action,
            "turn_intensity": float(np.clip(smoothed_turn, -1.0, 1.0)),
            "angle_debug": cmd.get("angle_debug", 0.0),
            "timestamp": time.time()
        }
        self.current_output = output

        self._draw_debug(image, output)
        return image, output

    def _interpret_gesture(self, hand_landmarks):
        try:
            lm = hand_landmarks.landmark
            # 使用 HandLandmark 枚举索引（清晰、稳定）
            H = self.mp_hands.HandLandmark

            # 更稳健的手指伸展判定
            fingers = []
            wrist_idx = H.WRIST
            fingers.append(self._finger_is_up(lm, H.INDEX_FINGER_TIP, H.INDEX_FINGER_PIP, wrist_idx))
            fingers.append(self._finger_is_up(lm, H.MIDDLE_FINGER_TIP, H.MIDDLE_FINGER_PIP, wrist_idx))
            fingers.append(self._finger_is_up(lm, H.RING_FINGER_TIP, H.RING_FINGER_PIP, wrist_idx))
            fingers.append(self._finger_is_up(lm, H.PINKY_TIP, H.PINKY_PIP, wrist_idx))
            num_fingers_up = int(sum(fingers))

            # 基本动作判定（可按需扩展 - 目前只看伸指数）
            base_action = "STOP"
            if num_fingers_up >= 3:
                base_action = "FORWARD"
            elif num_fingers_up == 0:
                base_action = "BACKWARD"
            else:
                base_action = "STOP"

            # 角度与转向强度（仅 FORWARD 时计算）
            turn_intensity = 0.0
            angle_deg = 0.0
            if base_action == "FORWARD":
                angle_deg = self._get_hand_angle(lm)

                # 定义阈值（注意 xp 必须升序）
                NEUTRAL_MIN = -100.0
                NEUTRAL_MAX = -80.0
                MAX_LEFT = -160.0
                MAX_RIGHT = -.0

                # 左侧（角度更小数值更负），xp 必须升序： [MAX_LEFT, NEUTRAL_MIN] -> [-1.0, 0.0]
                if angle_deg < NEUTRAL_MIN:
                    turn_intensity = np.interp(angle_deg, [MAX_LEFT, NEUTRAL_MIN], [-1.0, 0.0])
                # 右侧
                elif angle_deg > NEUTRAL_MAX:
                    turn_intensity = np.interp(angle_deg, [NEUTRAL_MAX, MAX_RIGHT], [0.0, 1.0])
                else:
                    turn_intensity = 0.0

            return {
                "base_action": base_action,
                "turn_intensity": float(turn_intensity),
                "angle_debug": float(angle_deg),
                "timestamp": time.time()
            }

        except Exception as e:
            print(f"Error in gesture interpretation: {e}")
            return self._get_stop_command()

    # --- 优化 2：更新调试信息的绘制 ---
    def _draw_debug(self, image, cmd, note=""):
        h, w = image.shape[:2]
        
        # 在屏幕上显示关键性能指标：处理耗时(P-Time)
        perf_text = f"P-Time: {self.processing_time:.1f} ms"
        
        action_text = f"Action: {cmd.get('base_action', 'N/A')}  Turn: {cmd.get('turn_intensity', 0.0):.2f}"
        
        cv2.putText(image, perf_text, (10, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(image, action_text, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        if note:
             cv2.putText(image, note, (10, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200,200,200), 1)