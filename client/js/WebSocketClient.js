// js/WebSocketClient.js

export class WebSocketClient {
    constructor() {
        this.socket = null;
        this.onMessageCallback = null;
        this.onStatusChangeCallback = null;
    }

    /**
     * 连接到WebSocket服务器。
     * @param {string} url - WebSocket服务器的URL (例如 'ws://192.168.1.10:8765')
     */
    connect(url) {
        console.log(`Attempting to connect to ${url}...`);
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback('Connecting...');
        }
        
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
            console.log('WebSocket connection established.');
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback('Connected!');
            }
        };

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.gesture && this.onMessageCallback) {
                    // 调用在main.js中设置的回调函数
                    this.onMessageCallback(data.gesture);
                }
            } catch (e) {
                console.error('Error parsing message data:', e);
            }
        };

        this.socket.onclose = () => {
            console.log('WebSocket connection closed. Retrying in 3 seconds...');
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback('Disconnected. Retrying...');
            }
            // 简单的自动重连逻辑
            setTimeout(() => this.connect(url), 3000);
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback('Connection Error!');
            }
            // onerror通常会触发onclose，所以重连逻辑会在onclose中处理
        };
    }
    
    /**
     * 注册一个回调函数，用于处理接收到的消息。
     * @param {function} callback - 当接收到消息时要调用的函数。
     */
    onMessage(callback) {
        this.onMessageCallback = callback;
    }

    /**
     * 注册一个回调函数，用于更新连接状态。
     * @param {function} callback - 当连接状态改变时要调用的函数。
     */
    onStatusChange(callback) {
        this.onStatusChangeCallback = callback;
    }
}