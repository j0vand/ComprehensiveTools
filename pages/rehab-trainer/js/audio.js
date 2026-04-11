/**
 * 语音管理模块
 * 使用 Web Speech API 实现TTS语音合成
 */

class VoiceManager {
    constructor() {
        this.synth = window.speechSynthesis;
        this.rate = 1.0; // 语速
        this.pitch = 1.0; // 音调
        this.volume = 1.0; // 音量
        this.lang = 'zh-CN'; // 中文
        this.enabled = true;
        this.currentUtterance = null;
        
        // 检查浏览器支持
        if (!VoiceManager.isSupported()) {
            console.warn('浏览器不支持语音合成');
            this.enabled = false;
            return;
        }

        // 等待语音列表加载（某些浏览器需要）
        if (this.synth.getVoices().length === 0) {
            this.synth.addEventListener('voiceschanged', () => {
                // 语音列表已加载
            }, { once: true });
        }
    }

    /**
     * 检查浏览器是否支持TTS
     */
    static isSupported() {
        return 'speechSynthesis' in window;
    }

    /**
     * 播放语音
     */
    speak(text, options = {}) {
        if (!this.enabled || !text) {
            return Promise.resolve();
        }

        // 检查浏览器支持
        if (!VoiceManager.isSupported()) {
            console.warn('浏览器不支持语音合成');
            return Promise.resolve();
        }

        // 停止当前播放
        this.stop();

        return new Promise((resolve, reject) => {
            try {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = this.lang;
                utterance.rate = options.rate || this.rate;
                utterance.pitch = options.pitch || this.pitch;
                utterance.volume = options.volume || this.volume;

                // 设置超时，防止语音卡住
                let timeoutId = setTimeout(() => {
                    this.synth.cancel();
                    this.currentUtterance = null;
                    resolve(); // 超时也resolve，不阻塞流程
                }, 10000); // 10秒超时

                utterance.onstart = () => {
                    clearTimeout(timeoutId);
                };

                utterance.onend = () => {
                    clearTimeout(timeoutId);
                    this.currentUtterance = null;
                    resolve();
                };

                utterance.onerror = (event) => {
                    clearTimeout(timeoutId);
                    // 记录错误但不阻塞流程
                    if (event.error !== 'not-allowed') {
                        console.warn('语音播放错误:', event.error, text);
                    }
                    this.currentUtterance = null;
                    resolve(); // 改为resolve而不是reject，继续执行
                };

                this.currentUtterance = utterance;
                
                // 尝试播放语音
                try {
                    this.synth.speak(utterance);
                } catch (speakError) {
                    clearTimeout(timeoutId);
                    console.warn('调用speechSynthesis.speak失败:', speakError);
                    this.currentUtterance = null;
                    resolve(); // 即使失败也resolve，不阻塞流程
                }
            } catch (error) {
                console.error('创建语音合成对象失败:', error);
                resolve(); // 改为resolve，不阻塞流程
            }
        });
    }

    /**
     * 快速语音提示（略快语速）
     */
    speakQuick(text) {
        return this.speak(text, { rate: 1.2 });
    }

    /**
     * 慢速语音（用于重要提示）
     */
    speakSlow(text) {
        return this.speak(text, { rate: 0.9 });
    }

    /**
     * 停止播放
     */
    stop() {
        if (this.synth.speaking) {
            this.synth.cancel();
        }
        this.currentUtterance = null;
    }

    /**
     * 暂停播放
     */
    pause() {
        if (this.synth.speaking && !this.synth.paused) {
            this.synth.pause();
        }
    }

    /**
     * 继续播放
     */
    resume() {
        if (this.synth.paused) {
            this.synth.resume();
        }
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

    /**
     * 启用/禁用语音
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.stop();
        }
    }

    /**
     * 是否正在播放
     */
    isSpeaking() {
        return this.synth.speaking;
    }

    // ==================== 训练相关语音提示 ====================

    /**
     * 准备开始训练
     */
    announceStart(seconds) {
        return this.speak(`准备开始训练，${seconds}秒后开始`);
    }

    /**
     * 倒计时（3、2、1）
     */
    async announceCountdown() {
        await this.speak('3');
        await new Promise(resolve => setTimeout(resolve, 800));
        await this.speak('2');
        await new Promise(resolve => setTimeout(resolve, 800));
        await this.speak('1');
        await new Promise(resolve => setTimeout(resolve, 800));
        await this.speak('开始');
    }

    /**
     * 持续时间型训练开始
     */
    announceDurationStart(exerciseName, duration, setNumber = null) {
        if (setNumber && setNumber > 1) {
            return this.speak(`第${setNumber}组，${exerciseName}，坚持${duration}秒`);
        }
        return this.speak(`${exerciseName}，坚持${duration}秒`);
    }
    
    /**
     * 训练开始详细提示（用于准备间隔后）
     */
    announceTrainingStart(exerciseName, setNumber, duration) {
        return this.speak(`第${setNumber}组，${exerciseName}，坚持${duration}秒`);
    }

    /**
     * 次数型训练开始
     */
    announceRepsStart(exerciseName, reps, setNumber = null) {
        if (setNumber && setNumber > 1) {
            return this.speak(`第${setNumber}组，${exerciseName}，做${reps}次`);
        }
        return this.speak(`${exerciseName}，做${reps}次，完成后点击按钮`);
    }

    /**
     * 中途提醒（持续时间型）
     */
    announceTimeRemaining(seconds) {
        return this.speak(`还剩${seconds}秒，坚持住`);
    }
    
    /**
     * 训练倒计时（全程只说数字）
     */
    announceTrainingCountdown(seconds) {
        return this.speak(seconds.toString());
    }
    
    /**
     * 休息倒计时（全程只说数字）
     */
    announceRestCountdown(seconds) {
        return this.speak(seconds.toString());
    }
    
    /**
     * 准备阶段倒计时（全程只说数字）
     */
    announcePrepareCountdown(seconds) {
        return this.speak(seconds.toString());
    }

    /**
     * 组完成
     */
    announceSetComplete(setNumber) {
        return this.speak(`第${setNumber}组完成`);
    }

    /**
     * 组间休息开始（详细提示）
     */
    announceSetRestStart(exerciseName, setNumber, restSeconds) {
        return this.speak(`第${setNumber}组完成，开始组间休息${restSeconds}秒`);
    }
    
    /**
     * 组间休息（保持兼容性）
     */
    announceSetRest(restSeconds) {
        if (restSeconds > 0) {
            return this.speak(`组间休息${restSeconds}秒`);
        }
        return this.speak('准备下一组');
    }
    
    /**
     * 准备间隔开始
     */
    announceTransitionStart(seconds) {
        return this.speak(`准备下一组，${seconds}秒后开始`);
    }
    
    /**
     * 准备间隔倒计时
     */
    announceTransitionCountdown(seconds) {
        return this.speak(seconds.toString());
    }

    /**
     * 切换到下一个动作
     */
    announceNextExercise(exerciseName) {
        return this.speak(`下一个动作：${exerciseName}`);
    }

    /**
     * 训练完成
     */
    announceComplete() {
        return this.speak('全部训练完成，做得很棒！');
    }

    /**
     * 暂停提示
     */
    announcePause() {
        return this.speak('已暂停');
    }

    /**
     * 继续提示
     */
    announceResume() {
        return this.speak('继续');
    }

    /**
     * 跳过提示
     */
    announceSkip() {
        return this.speak('跳过');
    }

    // ==================== 辅助方法 ====================

    /**
     * 播放鼓励语音
     */
    announceEncouragement() {
        const encouragements = [
            '很好',
            '做得不错',
            '继续加油',
            '保持住',
            '非常棒'
        ];
        const random = encouragements[Math.floor(Math.random() * encouragements.length)];
        return this.speak(random);
    }

    /**
     * 获取可用的语音列表
     */
    getVoices() {
        return this.synth.getVoices();
    }

    /**
     * 选择特定语音
     */
    selectVoice(voiceName) {
        const voices = this.getVoices();
        const voice = voices.find(v => v.name === voiceName);
        if (voice) {
            this.voice = voice;
        }
    }

    /**
     * 测试语音
     */
    test() {
        return this.speak('这是一个测试语音');
    }
}

// 创建全局实例
const voiceManager = new VoiceManager();
