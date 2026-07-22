/**
 * 主控制器
 * 整合所有模块，处理UI交互
 */

class RehabTrainerApp {
    constructor() {
        this.currentPlanId = null;
        this.currentExercises = [];
        this.editingExerciseId = null;
        this.deleteTarget = null;
        this.importInProgress = false;

        // 创建AbortController用于统一管理事件监听器
        this.abortController = new AbortController();
        this.signal = this.abortController.signal;

        this.initElements();
        this.initModals();
        this.initEventListeners();
        this.updateProgressCircle(0);
        this.loadPlans();
        this.initTrainingEvents();
        // 拖拽功能已移至计划管理界面，主界面不再支持拖拽
        this.loadVoiceSettings();
        this.checkAndDisplayVoiceSupport();

        document.addEventListener('visibilitychange', () => {
            const runningStates = [
                trainingTimer.STATE.PREPARING,
                trainingTimer.STATE.TRAINING,
                trainingTimer.STATE.SET_REST,
                trainingTimer.STATE.TRANSITION,
                trainingTimer.STATE.WAITING
            ];
            if (document.visibilityState === 'visible'
                && runningStates.includes(trainingTimer.state)) {
                screenWakeLock.request();
            }
        }, { signal: this.signal });

        // 页面卸载时清理事件监听器
        window.addEventListener('beforeunload', () => this.cleanup(), { signal: this.signal });
    }

    /**
     * 清理资源和事件监听器
     */
    cleanup() {
        // 取消所有通过AbortController注册的事件监听器
        this.abortController.abort();

        trainingTimer.stop();
        voiceManager.stop();
        screenWakeLock.release();
    }

    /**
     * 加载语音设置并应用到语音管理器
     */
    loadVoiceSettings() {
        try {
            const settings = storage.getSettings();
            if (settings) {
                if (settings.voiceRate !== undefined) {
                    voiceManager.setRate(settings.voiceRate);
                }
                if (settings.voiceVolume !== undefined) {
                    voiceManager.setVolume(settings.voiceVolume);
                }
            }
        } catch (error) {
            console.error('加载语音设置失败:', error);
        }
    }

    /**
     * 检查并显示语音支持状态
     */
    checkAndDisplayVoiceSupport() {
        if (!this.voiceStatusBar || !this.voiceStatusText) {
            return;
        }

        const isSupported = 'speechSynthesis' in window;
        if (isSupported) {
            // 检查是否有中文语音
            const checkChineseVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                const chineseVoices = voices.filter(v => v.lang.startsWith('zh'));
                
                if (chineseVoices.length > 0) {
                    this.voiceStatusBar.className = 'alert alert-success mb-0 text-center';
                    this.voiceStatusText.innerHTML = '<i class="bi bi-check-circle"></i> 语音功能已启用，支持中文语音提示';
                } else {
                    this.voiceStatusBar.className = 'alert alert-warning mb-0 text-center';
                    this.voiceStatusText.innerHTML = '<i class="bi bi-exclamation-triangle"></i> 浏览器支持语音，但未找到中文语音包（语音可能为英文）';
                }
                this.voiceStatusBar.style.display = 'block';
            };

            // 如果语音列表已加载
            if (window.speechSynthesis.getVoices().length > 0) {
                checkChineseVoices();
            } else {
                // 等待语音列表加载
                window.speechSynthesis.addEventListener('voiceschanged', checkChineseVoices, {
                    once: true,
                    signal: this.signal
                });
                // 设置超时，防止永远不触发
                setTimeout(() => {
                    if (this.voiceStatusBar.style.display === 'none') {
                        this.voiceStatusBar.className = 'alert alert-success mb-0 text-center';
                        this.voiceStatusText.innerHTML = '<i class="bi bi-check-circle"></i> 语音功能已启用';
                        this.voiceStatusBar.style.display = 'block';
                    }
                }, 1000);
            }
        } else {
            // 不支持语音
            this.voiceStatusBar.className = 'alert alert-danger mb-0 text-center';
            let message = '<i class="bi bi-x-circle"></i> <strong>当前浏览器不支持语音功能</strong><br>';
            message += '<small>建议使用 Chrome、Edge 或 Safari 浏览器以获得完整的语音提示功能</small>';
            
            this.voiceStatusText.innerHTML = message;
            this.voiceStatusBar.style.display = 'block';
        }
    }

    /**
     * 初始化DOM元素引用
     */
    initElements() {
        // 主界面元素
        this.planSelect = document.getElementById('planSelect');
        this.exerciseList = document.getElementById('exerciseList');
        this.emptyState = document.getElementById('emptyState');
        this.startTrainingBtn = document.getElementById('startTrainingBtn');
        this.voiceStatusBar = document.getElementById('voiceStatusBar');
        this.voiceStatusText = document.getElementById('voiceStatusText');
        
        // 训练界面元素
        this.mainView = document.getElementById('mainView');
        this.trainingView = document.getElementById('trainingView');
        this.exerciseName = document.getElementById('exerciseName');
        this.exerciseProgress = document.getElementById('exerciseProgress');
        this.setProgress = document.getElementById('setProgress');
        this.exerciseDescription = document.getElementById('exerciseDescription');
        
        // 持续时间型显示
        this.durationDisplay = document.getElementById('durationDisplay');
        this.timerDisplay = document.getElementById('timerDisplay');
        this.statusText = document.getElementById('statusText');
        this.progressCircle = document.getElementById('progressCircle');
        this.durationControls = document.getElementById('durationControls');
        this.pauseBtn = document.getElementById('pauseBtn');
        
        // 次数型显示
        this.repsDisplay = document.getElementById('repsDisplay');
        this.repsNumber = document.getElementById('repsNumber');
        this.repsStatus = document.getElementById('repsStatus');
        this.repsControls = document.getElementById('repsControls');
    }

    /**
     * 初始化模态框
     */
    initModals() {
        try {
            // 检查Bootstrap是否可用
            if (typeof bootstrap === 'undefined') {
                console.error('Bootstrap未加载，模态框功能将不可用');
                // 创建简单的模态框替代方案
                this.planModal = this.createFallbackModal('planModal');
                this.exerciseModal = this.createFallbackModal('exerciseModal');
                this.deleteModal = this.createFallbackModal('deleteModal');
                this.planManageModal = this.createFallbackModal('planManageModal');
            } else {
                this.planModal = new bootstrap.Modal(document.getElementById('planModal'));
                this.exerciseModal = new bootstrap.Modal(document.getElementById('exerciseModal'));
                this.deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
                this.planManageModal = new bootstrap.Modal(document.getElementById('planManageModal'));
            }
        } catch (error) {
            console.error('模态框初始化失败:', error);
            // 使用备用方案
            this.planModal = this.createFallbackModal('planModal');
            this.exerciseModal = this.createFallbackModal('exerciseModal');
            this.deleteModal = this.createFallbackModal('deleteModal');
            this.planManageModal = this.createFallbackModal('planManageModal');
        }
    }

    /**
     * 创建备用模态框（当Bootstrap不可用时）
     */
    createFallbackModal(modalId) {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) return null;

        modalElement.querySelectorAll('[data-bs-dismiss="modal"]').forEach(button => {
            button.addEventListener('click', () => this.hideFallbackModal(modalId), { signal: this.signal });
        });

        return {
            show: () => {
                this.hideFallbackModal(modalId);
                modalElement.style.display = 'block';
                modalElement.classList.add('show');
                modalElement.setAttribute('aria-modal', 'true');
                modalElement.removeAttribute('aria-hidden');
                // 显示背景遮罩
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop';
                backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1040;';
                backdrop.id = modalId + '_backdrop';
                document.body.appendChild(backdrop);
                // 点击背景关闭
                backdrop.addEventListener('click', () => this.hideFallbackModal(modalId), { signal: this.signal });
                modalElement.focus();
            },
            hide: () => {
                this.hideFallbackModal(modalId);
            }
        };
    }

    /**
     * 隐藏备用模态框
     */
    hideFallbackModal(modalId) {
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            modalElement.style.display = 'none';
            modalElement.classList.remove('show');
            modalElement.setAttribute('aria-hidden', 'true');
            modalElement.removeAttribute('aria-modal');
        }
        const backdrop = document.getElementById(modalId + '_backdrop');
        if (backdrop) {
            backdrop.remove();
        }
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        try {
            // 计划相关
            document.getElementById('newPlanBtn').addEventListener('click', () => this.showPlanModal(), { signal: this.signal });
            document.getElementById('planForm').addEventListener('submit', (event) => {
                event.preventDefault();
                this.savePlan();
            }, { signal: this.signal });
            this.planSelect.addEventListener('change', (e) => this.switchPlan(e.target.value), { signal: this.signal });

            // 导入导出
            document.getElementById('exportBtn').addEventListener('click', () => this.exportData(), { signal: this.signal });
            document.getElementById('importBtn').addEventListener('click', () => {
                if (this.importInProgress) {
                    this.showError('正在导入数据，请稍候');
                    return;
                }
                document.getElementById('importFile').click();
            }, { signal: this.signal });
            document.getElementById('importFile').addEventListener('change', (e) => this.importData(e), { signal: this.signal });

            // 计划管理
            document.getElementById('managePlansBtn').addEventListener('click', () => this.showPlanManageModal(), { signal: this.signal });

            // 训练项相关
            document.getElementById('addExerciseBtn').addEventListener('click', () => this.showExerciseModal(), { signal: this.signal });
            document.getElementById('exerciseForm').addEventListener('submit', (event) => {
                event.preventDefault();
                this.saveExercise();
            }, { signal: this.signal });

            // 训练类型切换
            document.querySelectorAll('input[name="exerciseType"]').forEach(radio => {
                radio.addEventListener('change', (e) => this.toggleExerciseType(e.target.value), { signal: this.signal });
            });
            
            // 开始训练
            this.startTrainingBtn.addEventListener('click', () => this.startTraining(), { signal: this.signal });
            
            // 训练控制按钮 - 持续时间型
            this.pauseBtn.addEventListener('click', () => this.togglePause(), { signal: this.signal });
            document.getElementById('skipBtn').addEventListener('click', () => this.skipExercise(), { signal: this.signal });
            document.getElementById('stopBtn').addEventListener('click', () => this.stopTraining(), { signal: this.signal });
            
            // 训练控制按钮 - 次数型
            document.getElementById('completeSetBtn').addEventListener('click', () => this.completeSet(), { signal: this.signal });
            document.getElementById('skipRepsBtn').addEventListener('click', () => this.skipExercise(), { signal: this.signal });
            document.getElementById('stopRepsBtn').addEventListener('click', () => this.stopTraining(), { signal: this.signal });
            
            // 删除确认
            document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.confirmDelete(), { signal: this.signal });
            
        } catch (error) {
            console.error('事件监听器初始化失败:', error);
            // 显示错误提示（使用统一通知组件）
            this.showError('初始化失败，请刷新页面重试。错误：' + error.message);
        }
    }

    /**
     * 初始化训练定时器事件
     */
    initTrainingEvents() {
        // 准备阶段
        trainingTimer.on('prepare', (data) => {
            this.showTrainingView();
            this.updateExerciseInfo(0);
            this.statusText.textContent = '准备开始';
            this.timerDisplay.textContent = data.duration;
            this.showDurationDisplay();
            voiceManager.speak(`准备开始训练，${data.duration}秒后开始`);
        });
        
        // 时间更新
        trainingTimer.on('tick', (data) => {
            this.timerDisplay.textContent = data.remaining;
            this.updateProgressCircle(data.progress);
        });
        
        // 所有倒计时只播报剩余秒数。
        ['prepareCountdown', 'trainingCountdown', 'restCountdown', 'transitionCountdown'].forEach(event => {
            trainingTimer.on(event, (data) => voiceManager.speak(String(data.remaining)));
        });
        
        // 组间休息开始（详细提示）
        trainingTimer.on('setRestStart', (data) => {
            this.statusText.textContent = '组间休息';
            this.timerDisplay.textContent = data.duration;
            this.showDurationDisplay();
            voiceManager.speak(`第${data.set}组完成，开始组间休息${data.duration}秒`);
        });
        
        // 准备间隔开始
        trainingTimer.on('transitionStart', (data) => {
            this.statusText.textContent = '准备下一组';
            this.timerDisplay.textContent = data.duration;
            this.showDurationDisplay();
            voiceManager.speak(`准备下一组，${data.duration}秒后开始`);
        });
        
        // 持续时间型训练开始
        trainingTimer.on('trainingStart', (data) => {
            this.updateExerciseInfo(trainingTimer.currentExerciseIndex);
            this.statusText.textContent = '训练中';
            this.timerDisplay.textContent = data.duration;
            this.showDurationDisplay();
            
            voiceManager.speak(`第${data.set}组，${data.exercise.name}，坚持${data.duration}秒`);
        });
        
        // 次数型训练开始
        trainingTimer.on('repsStart', (data) => {
            this.updateExerciseInfo(trainingTimer.currentExerciseIndex);
            this.repsNumber.textContent = data.reps;
            this.repsStatus.textContent = '请按自己的节奏完成';
            this.showRepsDisplay();
            voiceManager.speak(data.set > 1
                ? `第${data.set}组，${data.exercise.name}，做${data.reps}次`
                : `${data.exercise.name}，做${data.reps}次，完成后点击按钮`);
        });
        
        // 暂停
        trainingTimer.on('pause', () => {
            this.statusText.textContent = '已暂停';
            this.pauseBtn.innerHTML = '<i class="bi bi-play-fill"></i> 继续';
            voiceManager.speak('已暂停');
            screenWakeLock.release();
        });
        
        // 继续
        trainingTimer.on('resume', () => {
            // 根据当前状态更新UI
            if (trainingTimer.state === trainingTimer.STATE.PREPARING) {
                this.statusText.textContent = '准备开始';
            } else if (trainingTimer.state === trainingTimer.STATE.TRAINING) {
                this.statusText.textContent = '训练中';
            } else if (trainingTimer.state === trainingTimer.STATE.SET_REST) {
                this.statusText.textContent = '组间休息';
            } else if (trainingTimer.state === trainingTimer.STATE.TRANSITION) {
                this.statusText.textContent = '准备下一组';
            }
            this.pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i> 暂停';
            voiceManager.speak('继续');
            screenWakeLock.request();
        });
        
        // 完成
        trainingTimer.on('complete', () => {
            voiceManager.speak('全部训练完成，做得很棒！');

            // 释放屏幕常亮
            screenWakeLock.release();

            setTimeout(() => {
                this.showMainView();
            }, 2000);
        });
    }

    // ==================== 计划管理 ====================

    /**
     * 加载所有计划
     */
    loadPlans() {
        const plans = storage.getAllPlans();
        const activePlan = storage.getActivePlan();
        
        // 清空选择框
        this.planSelect.innerHTML = '<option value="">请选择训练计划</option>';
        
        // 如果没有任何计划，创建一个默认计划
        if (plans.length === 0) {
            const defaultPlan = { name: '我的训练计划' };
            if (!storage.savePlan(defaultPlan)) {
                this.showError('无法创建默认计划，请检查浏览器存储空间');
                this.emptyState.style.display = 'block';
                return;
            }
            this.loadPlans(); // 重新加载
            return;
        }
        
        // 添加计划选项
        plans.forEach(plan => {
            const option = document.createElement('option');
            option.value = plan.id;
            option.textContent = plan.name;
            this.planSelect.appendChild(option);
        });
        
        // 设置当前选中的计划
        if (activePlan) {
            this.planSelect.value = activePlan.id;
            this.switchPlan(activePlan.id, false);
        }
    }

    /**
     * 显示计划弹窗
     */
    showPlanModal() {
        document.getElementById('planName').value = '';
        this.planModal.show();
    }

    /**
     * 保存计划
     */
    savePlan() {
        const name = document.getElementById('planName').value.trim();
        
        if (!name) {
            this.showError('请输入计划名称');
            return;
        }
        if (name.length > 100) {
            this.showError('计划名称不能超过100个字符');
            return;
        }
        
        const plan = { name };
        
        if (storage.savePlan(plan)) {
            this.planModal.hide();
            this.loadPlans();
            
            // 选中新建的计划
            const plans = storage.getAllPlans();
            const newPlan = plans[plans.length - 1];
            this.planSelect.value = newPlan.id;
            this.switchPlan(newPlan.id);
        } else {
            this.showError('保存失败');
        }
    }

    /**
     * 切换计划
     */
    switchPlan(planId, shouldPersist = true) {
        if (!planId) {
            this.currentPlanId = null;
            this.currentExercises = [];
            this.renderExercises();
            return true;
        }

        if (shouldPersist && !storage.setActivePlan(planId)) {
            this.showError('切换计划失败，原计划保持不变');
            this.planSelect.value = this.currentPlanId || '';
            return false;
        }
        this.currentPlanId = planId;
        this.currentExercises = storage.getExercises(planId);
        this.renderExercises();
        return true;
    }

    // ==================== 训练项管理 ====================

    /**
     * 渲染训练项列表
     */
    renderExercises() {
        this.exerciseList.innerHTML = '';
        
        if (this.currentExercises.length === 0) {
            this.emptyState.style.display = 'block';
            this.startTrainingBtn.disabled = true;
            
            // 添加快速开始按钮
            if (!document.getElementById('quickStartBtn')) {
                const quickStartBtn = document.createElement('button');
                quickStartBtn.type = 'button';
                quickStartBtn.id = 'quickStartBtn';
                quickStartBtn.className = 'btn btn-info mt-3';
                quickStartBtn.innerHTML = '<i class="bi bi-lightning-fill"></i> 快速添加示例训练';
                quickStartBtn.addEventListener('click', () => this.addSampleExercises(), { signal: this.signal });
                this.emptyState.appendChild(quickStartBtn);
            }
            
            return;
        }
        
        this.emptyState.style.display = 'none';
        this.startTrainingBtn.disabled = false;
        
        this.currentExercises.forEach((exercise, index) => {
            const card = this.createExerciseCard(exercise, index);
            this.exerciseList.appendChild(card);
        });
    }

    /**
     * 添加示例训练项
     */
    addSampleExercises() {
        if (!this.currentPlanId) {
            this.showError('请先选择训练计划');
            return;
        }

        const samples = [
            {
                name: '小燕飞',
                type: 'reps',
                reps: 10,
                sets: 3,
                setRest: 60,
                description: '俯卧，双臂双腿同时抬起，保持2秒后放下'
            },
            {
                name: '平板支撑',
                type: 'duration',
                duration: 30,
                sets: 3,
                setRest: 60,
                description: '保持身体成一条直线，收紧核心，不要塌腰'
            },
            {
                name: '桥式',
                type: 'duration',
                duration: 30,
                sets: 3,
                setRest: 60,
                description: '仰卧，臀部抬起，身体成一条直线'
            }
        ];

        if (!storage.addExercises(this.currentPlanId, samples)) {
            this.showError('示例训练保存失败，未添加任何动作');
            return;
        }

        this.currentExercises = storage.getExercises(this.currentPlanId);
        this.renderExercises();
        
        // 显示成功提示
        this.showToast('已添加3个示例训练项');
    }

    /**
     * 显示错误消息（使用统一通知组件）
     */
    showError(message) {
        window.DialogService.showToast(message, 'error', { duration: 5000 });
    }

    showToast(message) {
        window.DialogService.showToast(message, 'success');
    }

    /**
     * 创建训练项卡片
     */
    createExerciseCard(exercise, index) {
        const card = document.createElement('div');
        card.className = 'exercise-card';
        // 主页面的卡片不再启用拖拽，拖拽功能移到管理界面
        const header = document.createElement('div');
        header.className = 'exercise-card-header';
        const title = document.createElement('h5');
        title.className = 'exercise-card-title';
        const number = document.createElement('span');
        number.className = 'exercise-card-number';
        number.textContent = index + 1;
        const name = document.createElement('span');
        name.textContent = exercise.name;
        title.appendChild(number);
        title.appendChild(name);

        const actions = document.createElement('div');
        actions.className = 'exercise-card-actions';
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'card-action-btn edit';
        editButton.setAttribute('aria-label', '编辑训练项');
        const editIcon = document.createElement('i');
        editIcon.className = 'bi bi-pencil';
        editButton.appendChild(editIcon);
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'card-action-btn delete';
        deleteButton.setAttribute('aria-label', '删除训练项');
        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'bi bi-trash';
        deleteButton.appendChild(deleteIcon);
        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        header.appendChild(title);
        header.appendChild(actions);
        card.appendChild(header);

        const typeBadge = document.createElement('span');
        typeBadge.className = 'exercise-card-type ' + (exercise.type === 'duration' ? 'type-duration' : 'type-reps');
        typeBadge.textContent = exercise.type === 'duration' ? '持续时间型' : '次数型';
        card.appendChild(typeBadge);

        const details = document.createElement('div');
        details.className = 'exercise-card-details';
        const detailRows = [
            exercise.type === 'duration'
                ? { icon: 'bi bi-clock', label: '坚持 ', value: exercise.duration + '秒' }
                : { icon: 'bi bi-arrow-repeat', label: '每组 ', value: exercise.reps + '次' },
            { icon: 'bi bi-layers', label: '', value: exercise.sets + '组' },
            { icon: 'bi bi-hourglass-split', label: '组间休息 ', value: exercise.setRest + '秒' }
        ];
        detailRows.forEach(detail => {
            const row = document.createElement('div');
            row.className = 'detail-item';
            const icon = document.createElement('i');
            icon.className = detail.icon;
            const label = document.createElement('span');
            label.textContent = detail.label;
            const value = document.createElement('span');
            value.className = 'detail-value';
            value.textContent = detail.value;
            row.appendChild(icon);
            row.appendChild(label);
            row.appendChild(value);
            details.appendChild(row);
        });
        card.appendChild(details);

        if (exercise.description) {
            const description = document.createElement('p');
            description.className = 'exercise-card-description';
            description.textContent = exercise.description;
            card.appendChild(description);
        }
        
        editButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.editExercise(exercise.id);
        }, { signal: this.signal });
        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.deleteExercise(exercise.id);
        }, { signal: this.signal });
        
        return card;
    }

    /**
     * 显示训练项弹窗
     */
    showExerciseModal(exercise = null) {
        if (!this.currentPlanId) {
            this.showError('请先选择或创建一个训练计划');
            return;
        }
        
        if (exercise) {
            // 编辑模式
            document.getElementById('exerciseModalTitle').textContent = '编辑训练项';
            document.getElementById('exerciseNameInput').value = exercise.name;
            document.getElementById('sets').value = exercise.sets;
            document.getElementById('setRest').value = exercise.setRest;
            document.getElementById('description').value = exercise.description || '';
            
            if (exercise.type === 'duration') {
                document.getElementById('typeDuration').checked = true;
                document.getElementById('duration').value = exercise.duration;
                this.toggleExerciseType('duration');
            } else {
                document.getElementById('typeReps').checked = true;
                document.getElementById('reps').value = exercise.reps;
                this.toggleExerciseType('reps');
            }
            
            this.editingExerciseId = exercise.id;
        } else {
            // 新建模式
            document.getElementById('exerciseModalTitle').textContent = '添加训练项';
            document.getElementById('exerciseForm').reset();
            document.getElementById('typeDuration').checked = true;
            this.toggleExerciseType('duration');
            this.editingExerciseId = null;
        }
        
        this.exerciseModal.show();
    }

    /**
     * 切换训练类型显示
     */
    toggleExerciseType(type) {
        const durationConfig = document.getElementById('durationConfig');
        const repsConfig = document.getElementById('repsConfig');
        const durationInput = document.getElementById('duration');
        const repsInput = document.getElementById('reps');
        
        if (type === 'duration') {
            durationConfig.style.display = 'block';
            repsConfig.style.display = 'none';
            durationInput.disabled = false;
            repsInput.disabled = true;
        } else {
            durationConfig.style.display = 'none';
            repsConfig.style.display = 'block';
            durationInput.disabled = true;
            repsInput.disabled = false;
        }
    }

    /**
     * 保存训练项
     */
    saveExercise() {
        const name = document.getElementById('exerciseNameInput').value.trim();
        const type = document.querySelector('input[name="exerciseType"]:checked').value;
        const sets = Number(document.getElementById('sets').value);
        const setRest = Number(document.getElementById('setRest').value);
        const description = document.getElementById('description').value.trim();
        
        if (!name) {
            this.showError('请输入训练项名称');
            return;
        }
        if (name.length > 100 || description.length > 2000) {
            this.showError('训练项名称或说明过长');
            return;
        }
        
        if (!Number.isSafeInteger(sets) || sets < 1 || sets > 100) {
            this.showError('请输入有效的组数');
            return;
        }
        
        if (!Number.isSafeInteger(setRest) || setRest < 0 || setRest > 86400) {
            this.showError('请输入有效的组间休息时间');
            return;
        }
        
        const exercise = {
            name,
            type,
            sets,
            setRest,
            description
        };
        
        if (type === 'duration') {
            exercise.duration = Number(document.getElementById('duration').value);
            if (!Number.isSafeInteger(exercise.duration) || exercise.duration < 1 || exercise.duration > 86400) {
                this.showError('请输入有效的持续时间');
                return;
            }
        } else {
            exercise.reps = Number(document.getElementById('reps').value);
            if (!Number.isSafeInteger(exercise.reps) || exercise.reps < 1 || exercise.reps > 10000) {
                this.showError('请输入有效的次数');
                return;
            }
        }
        
        let success = false;
        
        if (this.editingExerciseId) {
            // 更新
            success = storage.updateExercise(this.currentPlanId, this.editingExerciseId, exercise);
        } else {
            // 新建
            success = storage.addExercise(this.currentPlanId, exercise);
        }
        
        if (success) {
            this.exerciseModal.hide();
            this.currentExercises = storage.getExercises(this.currentPlanId);
            this.renderExercises();
        } else {
            this.showError('保存失败');
        }
    }

    /**
     * 编辑训练项
     */
    editExercise(exerciseId) {
        const exercise = this.currentExercises.find(e => e.id === exerciseId);
        if (exercise) {
            this.showExerciseModal(exercise);
        }
    }

    /**
     * 删除训练项
     */
    deleteExercise(exerciseId) {
        const exercise = this.currentExercises.find(e => e.id === exerciseId);
        if (!exercise) return;
        
        this.deleteTarget = { type: 'exercise', id: exerciseId };
        document.getElementById('deleteMessage').textContent = `确定要删除"${exercise.name}"吗？`;
        this.deleteModal.show();
    }

    /**
     * 确认删除
     */
    confirmDelete() {
        if (!this.deleteTarget) return;
        
        if (this.deleteTarget.type === 'exercise') {
            const planId = this.deleteTarget.planId || this.currentPlanId;
            if (storage.deleteExercise(planId, this.deleteTarget.id)) {
                this.switchPlan(this.currentPlanId, false);
                const manageModal = document.getElementById('planManageModal');
                if (manageModal && manageModal.classList.contains('show')) {
                    this.renderPlanManageList();
                }
            } else {
                this.showError('删除失败，训练项保持不变');
                return;
            }
        } else if (this.deleteTarget.type === 'plan') {
            if (!storage.deletePlan(this.deleteTarget.id)) {
                this.showError('删除失败，训练计划保持不变');
                return;
            }
            this.loadPlans();
            this.renderPlanManageList();
        }
        
        this.deleteModal.hide();
        this.deleteTarget = null;
    }

    // ==================== 训练执行 ====================

    /**
     * 开始训练
     */
    startTraining() {
        if (this.currentExercises.length === 0) {
            this.showError('没有训练项');
            return;
        }
        
        // 确保语音设置已加载
        this.loadVoiceSettings();
        
        const settings = storage.getSettings();
        const prepareTime = settings && settings.prepareTime !== undefined ? settings.prepareTime : 10;
        const transitionInterval = settings && settings.transitionInterval !== undefined ? settings.transitionInterval : 5;
        const countdownStart = settings && settings.countdownStart !== undefined ? settings.countdownStart : 10;

        if (!trainingTimer.start(this.currentExercises, prepareTime, transitionInterval, countdownStart)) {
            this.showError('训练计划包含非法时长、次数或组数，请先修正后再开始');
            return;
        }

        screenWakeLock.request();
    }

    /**
     * 显示训练界面
     */
    showTrainingView() {
        if (this.mainView) {
            this.mainView.style.display = 'none';
        }
        if (this.trainingView) {
            this.trainingView.style.display = 'flex';
        }
    }

    /**
     * 显示主界面
     */
    showMainView() {
        if (this.trainingView) {
            this.trainingView.style.display = 'none';
        }
        if (this.mainView) {
            this.mainView.style.display = 'block';
        }
    }

    /**
     * 更新训练项信息显示
     */
    updateExerciseInfo(exerciseIndex) {
        const exercise = this.currentExercises[exerciseIndex];
        const progress = trainingTimer.getProgress();
        
        this.exerciseName.textContent = exercise.name;
        this.exerciseProgress.textContent = `第${exerciseIndex + 1}个/共${this.currentExercises.length}个`;
        this.setProgress.textContent = `第${progress.currentSet}组/共${progress.totalSets}组`;
        this.exerciseDescription.textContent = exercise.description || '请按照动作要领完成训练';
    }

    /**
     * 显示持续时间型界面
     */
    showDurationDisplay() {
        this.durationDisplay.style.display = 'block';
        this.repsDisplay.style.display = 'none';
        this.durationControls.style.display = 'block';
        this.repsControls.style.display = 'none';
        this.pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i> 暂停';
        this.updateProgressCircle(0);
    }

    /**
     * 显示次数型界面
     */
    showRepsDisplay() {
        this.durationDisplay.style.display = 'none';
        this.repsDisplay.style.display = 'block';
        this.durationControls.style.display = 'none';
        this.repsControls.style.display = 'block';
    }

    /**
     * 更新进度圆环
     */
    updateProgressCircle(progress) {
        if (!this.progressCircle) return;
        
        const radius = this.progressCircle.r?.baseVal?.value || 120;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (progress / 100) * circumference;
        this.progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        this.progressCircle.style.strokeDashoffset = offset;
    }

    /**
     * 切换暂停/继续
     */
    togglePause() {
        if (trainingTimer.state === trainingTimer.STATE.PAUSED) {
            trainingTimer.resume();
        } else {
            trainingTimer.pause();
        }
    }

    /**
     * 完成一组（次数型）
     */
    completeSet() {
        trainingTimer.completeSet();
    }

    /**
     * 跳过当前训练项
     */
    async skipExercise() {
        const exerciseIndex = trainingTimer.currentExerciseIndex;
        const exercise = trainingTimer.getCurrentExercise();
        const state = trainingTimer.state;
        if (!await window.DialogService.confirmAction('确定要跳过当前训练项吗？')) return;
        if (trainingTimer.currentExerciseIndex !== exerciseIndex
            || trainingTimer.getCurrentExercise() !== exercise
            || trainingTimer.state !== state) {
            this.showToast('训练进度已变化，请重新操作');
            return;
        }
        if (trainingTimer.skip() && trainingTimer.state !== trainingTimer.STATE.COMPLETED) {
            screenWakeLock.request();
        }
    }

    /**
     * 停止训练
     */
    async stopTraining() {
        if (await window.DialogService.confirmAction('确定要结束训练吗？')) {
            trainingTimer.stop();
            voiceManager.stop();
            screenWakeLock.release();

            this.showMainView();
        }
    }

    // ==================== 计划管理界面 ====================

    /**
     * 显示计划管理界面
     */
    showPlanManageModal() {
        this.renderPlanManageList();
        this.planManageModal.show();
    }

    /**
     * 渲染计划管理列表
     */
    renderPlanManageList() {
        const container = document.getElementById('planManageList');
        if (!container) return;

        container.innerHTML = '';
        const plans = storage.getAllPlans();

        if (plans.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-4">还没有训练计划，请先创建计划</p>';
            return;
        }

        plans.forEach((plan, planIndex) => {
            const planCard = this.createPlanManageCard(plan, planIndex);
            container.appendChild(planCard);
        });

        // 初始化跨计划拖拽
        this.initCrossPlanDrag();
    }

    /**
     * 创建计划管理卡片
     */
    createPlanManageCard(plan, planIndex) {
        const card = document.createElement('div');
        card.className = 'card mb-3';

        const exercises = plan.exercises || [];
        const exerciseCount = exercises.length;

        const header = document.createElement('div');
        header.className = 'card-header d-flex justify-content-between align-items-center';
        const summary = document.createElement('div');
        summary.className = 'plan-manage-summary d-flex align-items-center gap-2';
        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'btn btn-sm btn-link p-0 text-decoration-none';
        toggleButton.setAttribute('data-bs-toggle', 'collapse');
        const collapseId = 'plan-manage-' + planIndex;
        toggleButton.setAttribute('data-bs-target', '#' + collapseId);
        toggleButton.setAttribute('aria-label', '展开或收起计划');
        const toggleIcon = document.createElement('i');
        toggleIcon.className = 'bi bi-chevron-down';
        toggleButton.appendChild(toggleIcon);
        const planName = document.createElement('h6');
        planName.className = 'mb-0';
        planName.textContent = plan.name;
        const count = document.createElement('span');
        count.className = 'badge bg-secondary';
        count.textContent = exerciseCount + ' 项';
        summary.appendChild(toggleButton);
        summary.appendChild(planName);
        summary.appendChild(count);

        const headerActions = document.createElement('div');
        headerActions.className = 'd-flex gap-2 flex-shrink-0';
        const renameButton = document.createElement('button');
        renameButton.type = 'button';
        renameButton.className = 'btn btn-sm btn-outline-primary';
        renameButton.title = '重命名计划';
        renameButton.setAttribute('aria-label', '重命名训练计划');
        const renameIcon = document.createElement('i');
        renameIcon.className = 'bi bi-pencil';
        renameButton.appendChild(renameIcon);
        const deletePlanButton = document.createElement('button');
        deletePlanButton.type = 'button';
        deletePlanButton.className = 'btn btn-sm btn-outline-danger';
        deletePlanButton.title = '删除计划';
        deletePlanButton.setAttribute('aria-label', '删除训练计划');
        const deletePlanIcon = document.createElement('i');
        deletePlanIcon.className = 'bi bi-trash';
        deletePlanButton.appendChild(deletePlanIcon);
        headerActions.appendChild(renameButton);
        headerActions.appendChild(deletePlanButton);
        header.appendChild(summary);
        header.appendChild(headerActions);

        const collapse = document.createElement('div');
        collapse.className = 'collapse show';
        collapse.id = collapseId;
        const body = document.createElement('div');
        body.className = 'card-body';
        const exerciseList = document.createElement('div');
        exerciseList.className = 'plan-exercise-list';
        exerciseList.dataset.planId = plan.id;
        if (exerciseCount === 0) {
            const empty = document.createElement('p');
            empty.className = 'text-muted text-center py-2 mb-0';
            empty.textContent = '暂无训练项，可拖动其他计划的训练项到这里';
            exerciseList.appendChild(empty);
        }
        body.appendChild(exerciseList);
        collapse.appendChild(body);
        card.appendChild(header);
        card.appendChild(collapse);

        // 渲染训练项
        exercises.forEach((exercise, index) => {
            const exerciseItem = this.createManageExerciseItem(exercise, index, plan.id);
            exerciseList.appendChild(exerciseItem);
        });

        renameButton.addEventListener('click', () => this.editPlanName(plan.id), { signal: this.signal });
        deletePlanButton.addEventListener('click', () => {
            this.deleteTarget = { type: 'plan', id: plan.id };
            document.getElementById('deleteMessage').textContent = `确定要删除训练计划"${plan.name}"吗？`;
            this.deleteModal.show();
        }, { signal: this.signal });

        return card;
    }

    /**
     * 创建管理界面的训练项
     */
    createManageExerciseItem(exercise, index, planId) {
        const item = document.createElement('div');
        item.className = 'manage-exercise-item mb-2 p-2';
        item.dataset.exerciseId = exercise.id;
        item.dataset.planId = planId;
        const typeText = exercise.type === 'duration' ? '持续时间型' : '次数型';

        const row = document.createElement('div');
        row.className = 'd-flex align-items-center gap-2';
        const dragHandle = document.createElement('div');
        dragHandle.className = 'exercise-card-drag-handle';
        dragHandle.title = '拖动排序或移动到其他计划';
        const dragIcon = document.createElement('i');
        dragIcon.className = 'bi bi-grip-vertical';
        dragHandle.appendChild(dragIcon);

        const content = document.createElement('div');
        content.className = 'manage-exercise-content flex-grow-1';
        const heading = document.createElement('div');
        heading.className = 'd-flex align-items-center gap-2';
        const number = document.createElement('span');
        number.className = 'badge bg-primary';
        number.textContent = index + 1;
        const name = document.createElement('strong');
        name.textContent = exercise.name;
        const type = document.createElement('span');
        type.className = 'badge ' + (exercise.type === 'duration' ? 'bg-info' : 'bg-success');
        type.textContent = typeText;
        heading.appendChild(number);
        heading.appendChild(name);
        heading.appendChild(type);
        const details = document.createElement('small');
        details.className = 'text-muted';
        details.textContent = (exercise.type === 'duration'
            ? '坚持' + exercise.duration + '秒'
            : '每组' + exercise.reps + '次')
            + ' · ' + exercise.sets + '组 · 组间休息' + exercise.setRest + '秒';
        content.appendChild(heading);
        content.appendChild(details);

        const actions = document.createElement('div');
        actions.className = 'btn-group btn-group-sm flex-shrink-0';
        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'btn btn-outline-primary';
        editButton.setAttribute('aria-label', '编辑训练项');
        const editIcon = document.createElement('i');
        editIcon.className = 'bi bi-pencil';
        editButton.appendChild(editIcon);
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn btn-outline-danger';
        deleteButton.setAttribute('aria-label', '删除训练项');
        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'bi bi-trash';
        deleteButton.appendChild(deleteIcon);
        actions.appendChild(editButton);
        actions.appendChild(deleteButton);
        row.appendChild(dragHandle);
        row.appendChild(content);
        row.appendChild(actions);
        item.appendChild(row);

        editButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.planManageModal.hide();
            if (!this.switchPlan(planId)) return;
            setTimeout(() => this.editExercise(exercise.id), 300);
        }, { signal: this.signal });
        deleteButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.deleteTarget = { type: 'exercise', id: exercise.id, planId };
            document.getElementById('deleteMessage').textContent = `确定要删除"${exercise.name}"吗？`;
            this.deleteModal.show();
        }, { signal: this.signal });

        dragHandle.draggable = true;
        dragHandle.addEventListener('dragstart', (event) => {
            event.stopPropagation();
            if (!event.dataTransfer) return;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', exercise.id);
            item.classList.add('dragging');
        }, { signal: this.signal });
        dragHandle.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        }, { signal: this.signal });

        return item;
    }

    /**
     * 初始化跨计划拖拽
     */
    initCrossPlanDrag() {
        const planLists = document.querySelectorAll('.plan-exercise-list');
        
        planLists.forEach(list => {
            list.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                
                const draggingItem = document.querySelector('.manage-exercise-item.dragging');
                if (draggingItem && draggingItem.parentElement !== list) {
                    list.classList.add('drag-over');
                }
            }, { signal: this.signal });

            list.addEventListener('dragleave', () => {
                list.classList.remove('drag-over');
            }, { signal: this.signal });

            list.addEventListener('drop', (e) => {
                e.preventDefault();
                list.classList.remove('drag-over');

                const draggingItem = document.querySelector('.manage-exercise-item.dragging');
                if (!draggingItem) return;
                const sourcePlanId = draggingItem.dataset.planId;
                const exerciseId = draggingItem.dataset.exerciseId;
                const targetPlanId = list.dataset.planId;

                if (sourcePlanId === targetPlanId) {
                    // 同计划内排序
                    this.handleSamePlanReorder(list, exerciseId, e);
                } else {
                    // 跨计划移动
                    this.handleCrossPlanMove(sourcePlanId, targetPlanId, exerciseId);
                }
            }, { signal: this.signal });
        });
    }

    /**
     * 处理同计划内排序
     */
    handleSamePlanReorder(list, exerciseId, e) {
        const items = Array.from(list.querySelectorAll('.manage-exercise-item'));
        const draggedItem = items.find(item => item.dataset.exerciseId === exerciseId);
        if (!draggedItem) return;

        const afterElement = this.getDragAfterElement(list, e.clientY);
        if (afterElement == null) {
            list.appendChild(draggedItem);
        } else {
            list.insertBefore(draggedItem, afterElement);
        }

        // 更新顺序
        const exerciseIds = Array.from(list.querySelectorAll('.manage-exercise-item'))
            .map(item => item.dataset.exerciseId);
        if (!storage.reorderExercises(list.dataset.planId, exerciseIds)) {
            this.showError('排序保存失败，已恢复原顺序');
            this.renderPlanManageList();
            return;
        }
        this.switchPlan(this.currentPlanId, false);
        
        list.querySelectorAll('.manage-exercise-item').forEach((item, index) => {
            item.querySelector('.badge.bg-primary').textContent = index + 1;
        });
        draggedItem.classList.remove('dragging');
    }

    /**
     * 处理跨计划移动
     */
    handleCrossPlanMove(sourcePlanId, targetPlanId, exerciseId) {
        const exercise = storage.getExercises(sourcePlanId).find(e => e.id === exerciseId);
        if (!exercise) return;

        if (!storage.moveExercise(sourcePlanId, targetPlanId, exerciseId)) {
            this.showError('移动失败，源计划和目标计划均未改变');
            this.renderPlanManageList();
            return;
        }

        // 重新渲染
        this.switchPlan(this.currentPlanId, false);
        this.renderPlanManageList();
        this.showToast(`已将"${exercise.name}"移动到目标计划`);
    }

    /**
     * 获取拖拽后的元素位置
     */
    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.manage-exercise-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    /**
     * 编辑计划名称
     */
    async editPlanName(planId) {
        const plan = storage.getPlanById(planId);
        if (!plan) return;

        let defaultValue = plan.name;
        while (true) {
            const prompt = window.DialogService.promptAction('请输入新的计划名称', {
                defaultValue,
                confirmText: '保存'
            });
            const backdrops = document.querySelectorAll('.tool-dialog-backdrop');
            const backdrop = backdrops[backdrops.length - 1];
            const manageModal = document.getElementById('planManageModal');
            if (backdrop && manageModal && manageModal.classList.contains('show')) {
                // Bootstrap会把弹层外的焦点抢回；对话框放进当前弹层以保留键盘操作。
                manageModal.appendChild(backdrop);
                backdrop.addEventListener('keydown', event => event.stopPropagation());
                const input = backdrop.querySelector('.tool-dialog-input');
                if (input) input.focus();
            }
            const newName = await prompt;
            if (newName === null) return;
            const trimmed = newName.trim();
            if (!trimmed || trimmed.length > 100) {
                this.showError('计划名称不能为空且不能超过100个字符');
                defaultValue = newName;
                continue;
            }
            if (trimmed === plan.name) return;
            const updatedPlan = { ...plan, name: trimmed };
            if (!storage.savePlan(updatedPlan)) {
                this.showError('重命名保存失败，计划名称保持不变');
                return;
            }
            this.renderPlanManageList();
            this.loadPlans(); // 更新主页面的计划列表
            this.showToast('计划名称已更新');
            return;
        }
    }
}

let hasInitializedApp = false;

// 页面加载完成后初始化应用
function initializeApp() {
    if (hasInitializedApp) return;
    hasInitializedApp = true;

    try {
        window.app = new RehabTrainerApp();
    } catch (error) {
        console.error('应用初始化失败:', error);
        const message = '应用初始化失败：' + error.message + '\n请刷新页面重试。';
        if (window.DialogService && window.DialogService.showToast) {
            window.DialogService.showToast(message, 'error', { duration: 5000 });
        } else if (window.CommonUtils && window.CommonUtils.showNotification) {
            window.CommonUtils.showNotification(message, 'error', 5000);
        } else {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger m-3';
            errorDiv.setAttribute('role', 'alert');
            errorDiv.textContent = message;
            document.body.prepend(errorDiv);
        }
    }
}

document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
if (document.readyState !== 'loading') {
    initializeApp();
}
