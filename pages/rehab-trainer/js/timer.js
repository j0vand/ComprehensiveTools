/**
 * 计时器核心模块
 * 负责训练流程的时间控制和状态管理
 */

class TrainingTimer {
    constructor() {
        // 状态常量
        this.STATE = {
            IDLE: 'idle',           // 空闲
            PREPARING: 'preparing',  // 准备中
            TRAINING: 'training',    // 训练中
            RESTING: 'resting',      // 组内休息（持续时间型）
            SET_REST: 'set_rest',    // 组间休息
            TRANSITION: 'transition', // 准备间隔（休息结束到训练开始之间）
            WAITING: 'waiting',      // 等待用户操作（次数型）
            PAUSED: 'paused',        // 暂停
            COMPLETED: 'completed'   // 完成
        };

        this.reset();
    }

    /**
     * 重置所有状态
     */
    reset() {
        this.state = this.STATE.IDLE;
        this.exercises = [];
        this.currentExerciseIndex = 0;
        this.currentSet = 1;
        this.startTime = 0;
        this.pausedTime = 0;
        this.duration = 0;
        this.intervalId = null;
        this.lastCountdownSecond = null; // 记录上次倒计时播报的秒数，防止重复
        this.transitionInterval = 5; // 默认准备间隔5秒
        this.countdownStart = 10; // 默认倒计时从10秒开始
        this.previousState = null; // 保存暂停前的状态
        // 如果callbacks未初始化，则初始化；否则保留事件监听器
        if (!this.callbacks) {
            this.callbacks = {};
        }
    }

    /**
     * 开始训练流程
     */
    start(exercises, prepareTime = 10, transitionInterval = 5, countdownStart = 10) {
        if (!exercises || exercises.length === 0) {
            console.error('没有训练项');
            return false;
        }

        this.reset();
        this.exercises = exercises;
        this.prepareTime = prepareTime;
        this.transitionInterval = transitionInterval;
        this.countdownStart = countdownStart;
        
        // 开始准备倒计时
        this.startPrepare();
        return true;
    }

    /**
     * 开始准备阶段
     */
    startPrepare() {
        this.state = this.STATE.PREPARING;
        this.duration = this.prepareTime;
        this.lastCountdownSecond = null; // 重置倒计时标志
        this.startTimer();
        this.trigger('prepare', { duration: this.prepareTime });
    }

    /**
     * 开始训练项
     */
    startExercise() {
        const exercise = this.getCurrentExercise();
        if (!exercise) {
            this.complete();
            return;
        }

        this.currentSet = 1;
        
        if (exercise.type === 'duration') {
            this.startDurationTraining();
        } else if (exercise.type === 'reps') {
            this.startRepsTraining();
        }
    }

    /**
     * 开始持续时间型训练
     */
    startDurationTraining() {
        const exercise = this.getCurrentExercise();
        this.state = this.STATE.TRAINING;
        this.duration = exercise.duration;
        this.lastCountdownSecond = null; // 重置倒计时标志
        this.startTimer();
        
        this.trigger('trainingStart', {
            exercise: exercise,
            set: this.currentSet,
            duration: exercise.duration
        });
    }

    /**
     * 开始次数型训练
     */
    startRepsTraining() {
        const exercise = this.getCurrentExercise();
        this.state = this.STATE.WAITING;
        
        this.trigger('repsStart', {
            exercise: exercise,
            set: this.currentSet,
            reps: exercise.reps
        });
    }

    /**
     * 开始组间休息
     */
    startSetRest() {
        const exercise = this.getCurrentExercise();
        
        if (exercise.setRest > 0) {
            this.state = this.STATE.SET_REST;
            this.duration = exercise.setRest;
            this.lastCountdownSecond = null; // 重置倒计时标志
            this.startTimer();
            
            // 触发详细的休息开始事件
            this.trigger('setRestStart', {
                exercise: exercise,
                set: this.currentSet,
                duration: exercise.setRest
            });
            
            // 也触发原来的setRest事件以保持兼容性
            this.trigger('setRest', {
                exercise: exercise,
                set: this.currentSet,
                duration: exercise.setRest
            });
        } else {
            // 没有组间休息，直接进入准备间隔
            this.startTransition();
        }
    }

    /**
     * 启动计时器
     */
    startTimer() {
        this.startTime = Date.now();
        this.pausedTime = 0;
        
        this.intervalId = setInterval(() => {
            this.tick();
        }, 100); // 每100ms更新一次
    }

    /**
     * 计时器tick
     */
    tick() {
        if (this.state === this.STATE.PAUSED) {
            return;
        }

        const elapsed = (Date.now() - this.startTime) / 1000;
        const remaining = Math.max(0, this.duration - elapsed);
        const progress = this.duration > 0 ? (elapsed / this.duration) * 100 : 0;
        const remainingCeil = Math.ceil(remaining);

        this.trigger('tick', {
            remaining: remainingCeil,
            progress: Math.min(100, progress),
            elapsed: elapsed
        });

        // 时间到
        if (remaining <= 0) {
            this.onTimerComplete();
            return;
        }

        // 倒计时提醒逻辑
        const countdownStart = this.countdownStart || 10;
        
        // 准备阶段倒计时：剩余时间 <= 3 且 > 0 时，每秒播报
        if (this.state === this.STATE.PREPARING && remainingCeil <= 3 && remainingCeil > 0) {
            if (this.lastCountdownSecond !== remainingCeil) {
                this.lastCountdownSecond = remainingCeil;
                this.trigger('prepareCountdown', { remaining: remainingCeil });
            }
        }
        // 训练倒计时：剩余时间 <= countdownStart 且 > 0 时，每秒播报
        else if (this.state === this.STATE.TRAINING && remainingCeil <= countdownStart && remainingCeil > 0) {
            if (this.lastCountdownSecond !== remainingCeil) {
                this.lastCountdownSecond = remainingCeil;
                this.trigger('trainingCountdown', { remaining: remainingCeil });
            }
        }
        // 休息倒计时：剩余时间 <= countdownStart 且 > 0 时，每秒播报
        else if (this.state === this.STATE.SET_REST && remainingCeil <= countdownStart && remainingCeil > 0) {
            if (this.lastCountdownSecond !== remainingCeil) {
                this.lastCountdownSecond = remainingCeil;
                this.trigger('restCountdown', { remaining: remainingCeil });
            }
        }
        // 准备间隔倒计时：剩余时间 <= 3 且 > 0 时，每秒播报
        else if (this.state === this.STATE.TRANSITION && remainingCeil <= 3 && remainingCeil > 0) {
            if (this.lastCountdownSecond !== remainingCeil) {
                this.lastCountdownSecond = remainingCeil;
                this.trigger('transitionCountdown', { remaining: remainingCeil });
            }
        }
        // 其他状态重置倒计时标志
        else {
            this.lastCountdownSecond = null;
        }
    }

    /**
     * 计时器完成回调
     */
    onTimerComplete() {
        this.stopTimer();

        switch (this.state) {
            case this.STATE.PREPARING:
                // 准备完成，开始第一个训练项
                this.startExercise();
                break;

            case this.STATE.TRAINING:
                // 训练完成，检查是否还有组
                if (this.hasMoreSets()) {
                    this.startSetRest();
                } else {
                    this.nextExercise();
                }
                break;

            case this.STATE.SET_REST:
                // 组间休息完成，进入准备间隔
                this.startTransition();
                break;

            case this.STATE.TRANSITION:
                // 准备间隔完成，触发transitionEnd事件，然后开始下一组
                this.trigger('transitionEnd', {
                    exercise: this.getCurrentExercise(),
                    set: this.currentSet + 1
                });
                this.nextSet();
                break;
        }
    }

    /**
     * 停止计时器
     */
    stopTimer() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * 暂停
     */
    pause() {
        if (this.state !== this.STATE.TRAINING && this.state !== this.STATE.SET_REST && this.state !== this.STATE.TRANSITION) {
            return false;
        }

        this.previousState = this.state; // 保存暂停前的状态
        this.pausedTime = Date.now();
        this.state = this.STATE.PAUSED;
        this.trigger('pause');
        return true;
    }

    /**
     * 继续
     */
    resume() {
        if (this.state !== this.STATE.PAUSED) {
            return false;
        }

        const pauseDuration = Date.now() - this.pausedTime;
        this.startTime += pauseDuration;
        // 恢复之前的状态
        if (this.previousState) {
            this.state = this.previousState;
            this.previousState = null;
        }
        this.trigger('resume');
        return true;
    }

    /**
     * 完成一组（次数型）
     */
    completeSet() {
        if (this.state !== this.STATE.WAITING) {
            return false;
        }

        this.trigger('setComplete', {
            exercise: this.getCurrentExercise(),
            set: this.currentSet
        });

        if (this.hasMoreSets()) {
            this.startSetRest();
        } else {
            this.nextExercise();
        }
        
        return true;
    }

    /**
     * 跳过当前项
     */
    skip() {
        this.stopTimer();
        this.trigger('skip', {
            exercise: this.getCurrentExercise(),
            set: this.currentSet
        });
        this.nextExercise();
    }

    /**
     * 停止训练
     */
    stop() {
        this.stopTimer();
        this.trigger('stop');
        this.reset();
    }

    /**
     * 完成所有训练
     */
    complete() {
        this.stopTimer();
        this.state = this.STATE.COMPLETED;
        this.trigger('complete');
    }

    /**
     * 下一组
     */
    nextSet() {
        this.currentSet++;
        const exercise = this.getCurrentExercise();
        
        if (exercise.type === 'duration') {
            this.startDurationTraining();
        } else {
            this.startRepsTraining();
        }
    }

    /**
     * 下一个训练项
     */
    nextExercise() {
        this.currentExerciseIndex++;
        
        if (this.currentExerciseIndex < this.exercises.length) {
            this.trigger('nextExercise', {
                exercise: this.getCurrentExercise()
            });
            this.startExercise();
        } else {
            this.complete();
        }
    }

    /**
     * 是否还有更多组
     */
    hasMoreSets() {
        const exercise = this.getCurrentExercise();
        return this.currentSet < exercise.sets;
    }

    /**
     * 获取当前训练项
     */
    getCurrentExercise() {
        return this.exercises[this.currentExerciseIndex] || null;
    }

    /**
     * 获取当前进度信息
     */
    getProgress() {
        return {
            currentExerciseIndex: this.currentExerciseIndex,
            totalExercises: this.exercises.length,
            currentSet: this.currentSet,
            totalSets: this.getCurrentExercise()?.sets || 0,
            state: this.state
        };
    }

    /**
     * 注册事件回调
     */
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
    }

    /**
     * 触发事件
     */
    trigger(event, data = {}) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`事件回调错误 [${event}]:`, e);
                }
            });
        }
    }

    /**
     * 移除事件监听
     */
    off(event, callback) {
        if (!this.callbacks[event]) return;
        
        if (callback) {
            this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
        } else {
            delete this.callbacks[event];
        }
    }

    /**
     * 开始准备间隔（休息结束到训练开始之间）
     */
    startTransition() {
        this.state = this.STATE.TRANSITION;
        this.duration = this.transitionInterval;
        this.lastCountdownSecond = null; // 重置倒计时标志
        this.startTimer();
        
        this.trigger('transitionStart', {
            exercise: this.getCurrentExercise(),
            set: this.currentSet + 1,
            duration: this.transitionInterval
        });
    }

    /**
     * 获取状态文本
     */
    getStateText() {
        const stateTexts = {
            [this.STATE.IDLE]: '空闲',
            [this.STATE.PREPARING]: '准备中',
            [this.STATE.TRAINING]: '训练中',
            [this.STATE.RESTING]: '休息中',
            [this.STATE.SET_REST]: '组间休息',
            [this.STATE.TRANSITION]: '准备下一组',
            [this.STATE.WAITING]: '等待操作',
            [this.STATE.PAUSED]: '已暂停',
            [this.STATE.COMPLETED]: '已完成'
        };
        return stateTexts[this.state] || '未知';
    }
}

// 创建全局实例
const trainingTimer = new TrainingTimer();
