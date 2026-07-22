/**
 * 语音管理模块
 * 使用 Web Speech API 实现TTS语音合成
 */

class VoiceManager {
    constructor() {
        this.synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
        this.rate = 1.0; // 语速
        this.volume = 1.0; // 音量
        this.lang = 'zh-CN'; // 中文
        this.currentUtterance = null;

        if (!this.synth) {
            console.warn('浏览器不支持语音合成');
        }
    }

    /**
     * 播放语音
     */
    speak(text) {
        if (!text || !this.synth) return;

        // 训练提示只保留最新一条，避免倒计时和阶段提示排队后失去时效。
        this.stop();

        let utterance;
        try {
            utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.lang;
            utterance.rate = this.rate;
            utterance.volume = this.volume;

            const finish = () => {
                if (this.currentUtterance === utterance) this.currentUtterance = null;
            };
            utterance.onend = finish;
            utterance.onerror = (event) => {
                if (!['canceled', 'interrupted', 'not-allowed'].includes(event.error)) {
                    console.warn('语音播放错误:', event.error, text);
                }
                finish();
            };

            this.currentUtterance = utterance;
            this.synth.speak(utterance);
        } catch (error) {
            if (this.currentUtterance === utterance) this.currentUtterance = null;
            console.warn('语音播放失败:', error);
        }
    }

    /**
     * 停止播放
     */
    stop() {
        if (this.synth) {
            this.synth.cancel();
        }
        this.currentUtterance = null;
    }

    /**
     * 设置语速
     */
    setRate(rate) {
        this.rate = Math.max(0.1, Math.min(10, rate));
    }

    /**
     * 设置音量
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }

}

// 创建全局实例
const voiceManager = new VoiceManager();
