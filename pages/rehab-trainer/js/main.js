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
        
        this.initElements();
        this.initModals();
        this.initEventListeners();
        this.initProgressCircle();
        this.loadPlans();
        this.initTrainingEvents();
        
        // iOS需要用户交互后才能使用TTS，显示提示
        if (this.isIOS()) {
            this.initVoiceOnFirstInteraction();
        }
    }

    /**
     * 检测是否为iOS设备
     */
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    }

    /**
     * iOS首次交互时初始化语音
     */
    initVoiceOnFirstInteraction() {
        const initVoice = () => {
            voiceManager.speak(''); // 空语音激活TTS
            document.removeEventListener('touchstart', initVoice);
            document.removeEventListener('click', initVoice);
        };
        
        document.addEventListener('touchstart', initVoice, { once: true });
        document.addEventListener('click', initVoice, { once: true });
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
            } else {
                this.planModal = new bootstrap.Modal(document.getElementById('planModal'));
                this.exerciseModal = new bootstrap.Modal(document.getElementById('exerciseModal'));
                this.deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
            }
        } catch (error) {
            console.error('模态框初始化失败:', error);
            // 使用备用方案
            this.planModal = this.createFallbackModal('planModal');
            this.exerciseModal = this.createFallbackModal('exerciseModal');
            this.deleteModal = this.createFallbackModal('deleteModal');
        }
    }

    /**
     * 创建备用模态框（当Bootstrap不可用时）
     */
    createFallbackModal(modalId) {
        const modalElement = document.getElementById(modalId);
        if (!modalElement) return null;
        
        return {
            show: () => {
                modalElement.style.display = 'block';
                modalElement.style.opacity = '1';
                // 显示背景遮罩
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop';
                backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:1040;';
                backdrop.id = modalId + '_backdrop';
                document.body.appendChild(backdrop);
                // 点击背景关闭
                backdrop.addEventListener('click', () => this.hideFallbackModal(modalId));
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
        }
        const backdrop = document.getElementById(modalId + '_backdrop');
        if (backdrop) {
            backdrop.remove();
        }
    }

    /**
     * 添加移动端兼容的事件监听器
     */
    addMobileEventListener(element, event, handler) {
        if (!element) {
            const errorMsg = `元素不存在: ${event}`;
            console.error(errorMsg);
            window.addDebugLog && window.addDebugLog('error', errorMsg);
            return;
        }
        
        // 移动端优先使用touchstart，桌面端使用click
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        try {
            if (isMobile) {
                // 移动端：使用touchstart，并阻止默认行为避免双击缩放
                const touchHandler = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.addDebugLog && window.addDebugLog('info', `触摸事件触发: ${element.id || element.className}`, {
                        type: 'touchstart',
                        target: element.id || element.className
                    });
                    handler(e);
                };
                
                element.addEventListener('touchstart', touchHandler, { passive: false });
                
                // 同时保留click作为备用
                const clickHandler = (e) => {
                    window.addDebugLog && window.addDebugLog('info', `点击事件触发: ${element.id || element.className}`, {
                        type: 'click',
                        target: element.id || element.className
                    });
                    handler(e);
                };
                element.addEventListener('click', clickHandler);
                
                window.addDebugLog && window.addDebugLog('success', `已绑定事件监听器: ${element.id || element.className}`, {
                    touchstart: true,
                    click: true
                });
            } else {
                // 桌面端：只使用click
                const clickHandler = (e) => {
                    window.addDebugLog && window.addDebugLog('info', `点击事件触发: ${element.id || element.className}`);
                    handler(e);
                };
                element.addEventListener('click', clickHandler);
                
                window.addDebugLog && window.addDebugLog('success', `已绑定事件监听器: ${element.id || element.className}`, {
                    click: true
                });
            }
        } catch (error) {
            const errorMsg = `绑定事件监听器失败: ${element.id || element.className}, 错误: ${error.message}`;
            console.error(errorMsg, error);
            window.addDebugLog && window.addDebugLog('error', errorMsg, { error: error.toString() });
        }
    }

    /**
     * 初始化事件监听
     */
    initEventListeners() {
        try {
            // 计划相关
            this.addMobileEventListener(document.getElementById('newPlanBtn'), 'click', () => this.showPlanModal());
            this.addMobileEventListener(document.getElementById('savePlanBtn'), 'click', () => this.savePlan());
            this.planSelect.addEventListener('change', (e) => this.switchPlan(e.target.value));
            
            // 导入导出
            this.addMobileEventListener(document.getElementById('exportBtn'), 'click', () => this.exportData());
            this.addMobileEventListener(document.getElementById('importBtn'), 'click', () => this.triggerImport());
            document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
            
            // 训练项相关
            this.addMobileEventListener(document.getElementById('addExerciseBtn'), 'click', () => this.showExerciseModal());
            this.addMobileEventListener(document.getElementById('saveExerciseBtn'), 'click', () => this.saveExercise());
            
            // 训练类型切换
            document.querySelectorAll('input[name="exerciseType"]').forEach(radio => {
                radio.addEventListener('change', (e) => this.toggleExerciseType(e.target.value));
            });
            
            // 开始训练
            this.addMobileEventListener(this.startTrainingBtn, 'click', () => this.startTraining());
            
            // 训练控制按钮 - 持续时间型
            this.addMobileEventListener(document.getElementById('pauseBtn'), 'click', () => this.togglePause());
            this.addMobileEventListener(document.getElementById('skipBtn'), 'click', () => this.skipExercise());
            this.addMobileEventListener(document.getElementById('stopBtn'), 'click', () => this.stopTraining());
            
            // 训练控制按钮 - 次数型
            this.addMobileEventListener(document.getElementById('completeSetBtn'), 'click', () => this.completeSet());
            this.addMobileEventListener(document.getElementById('skipRepsBtn'), 'click', () => this.skipExercise());
            this.addMobileEventListener(document.getElementById('stopRepsBtn'), 'click', () => this.stopTraining());
            
            // 删除确认
            this.addMobileEventListener(document.getElementById('confirmDeleteBtn'), 'click', () => this.confirmDelete());
            
            console.log('事件监听器初始化完成');
        } catch (error) {
            console.error('事件监听器初始化失败:', error);
            // 显示错误提示
            alert('初始化失败，请刷新页面重试。错误：' + error.message);
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
            voiceManager.announceStart(data.duration);
        });
        
        // 时间更新
        trainingTimer.on('tick', (data) => {
            this.timerDisplay.textContent = data.remaining;
            this.updateProgressCircle(data.progress);
            
            // 准备阶段最后3秒倒数
            if (trainingTimer.state === trainingTimer.STATE.PREPARING && data.remaining <= 3 && data.remaining > 0) {
                voiceManager.speak(data.remaining.toString());
            }
        });
        
        // 持续时间型训练开始
        trainingTimer.on('trainingStart', (data) => {
            this.updateExerciseInfo(trainingTimer.currentExerciseIndex);
            this.statusText.textContent = '训练中';
            this.timerDisplay.textContent = data.duration;
            this.showDurationDisplay();
            
            if (trainingTimer.currentSet === 1) {
                voiceManager.announceDurationStart(data.exercise.name, data.duration);
            }
        });
        
        // 次数型训练开始
        trainingTimer.on('repsStart', (data) => {
            this.updateExerciseInfo(trainingTimer.currentExerciseIndex);
            this.repsNumber.textContent = data.reps;
            this.repsStatus.textContent = '请按自己的节奏完成';
            this.showRepsDisplay();
            voiceManager.announceRepsStart(data.exercise.name, data.reps, data.set);
        });
        
        // 10秒提醒
        trainingTimer.on('reminder', () => {
            voiceManager.announceTimeRemaining(10);
        });
        
        // 组完成
        trainingTimer.on('setComplete', (data) => {
            voiceManager.announceSetComplete(data.set);
        });
        
        // 组间休息
        trainingTimer.on('setRest', (data) => {
            this.statusText.textContent = '组间休息';
            this.timerDisplay.textContent = data.duration;
            this.showDurationDisplay();
            voiceManager.announceSetRest(data.duration);
        });
        
        // 下一个训练项
        trainingTimer.on('nextExercise', (data) => {
            voiceManager.announceNextExercise(data.exercise.name);
        });
        
        // 暂停
        trainingTimer.on('pause', () => {
            this.statusText.textContent = '已暂停';
            document.getElementById('pauseBtn').innerHTML = '<i class="bi bi-play-fill"></i> 继续';
            voiceManager.announcePause();
        });
        
        // 继续
        trainingTimer.on('resume', () => {
            this.statusText.textContent = '训练中';
            document.getElementById('pauseBtn').innerHTML = '<i class="bi bi-pause-fill"></i> 暂停';
            voiceManager.announceResume();
        });
        
        // 跳过
        trainingTimer.on('skip', () => {
            voiceManager.announceSkip();
        });
        
        // 完成
        trainingTimer.on('complete', () => {
            voiceManager.announceComplete();
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
            storage.savePlan(defaultPlan);
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
            this.switchPlan(activePlan.id);
        }
    }

    /**
     * 显示计划弹窗
     */
    showPlanModal() {
        document.getElementById('planModalTitle').textContent = '新建训练计划';
        document.getElementById('planName').value = '';
        this.planModal.show();
    }

    /**
     * 保存计划
     */
    savePlan() {
        const name = document.getElementById('planName').value.trim();
        
        if (!name) {
            alert('请输入计划名称');
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
            alert('保存失败');
        }
    }

    /**
     * 切换计划
     */
    switchPlan(planId) {
        if (!planId) {
            this.currentPlanId = null;
            this.currentExercises = [];
            this.renderExercises();
            return;
        }
        
        storage.setActivePlan(planId);
        this.currentPlanId = planId;
        this.currentExercises = storage.getExercises(planId);
        this.renderExercises();
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
                quickStartBtn.id = 'quickStartBtn';
                quickStartBtn.className = 'btn btn-info mt-3';
                quickStartBtn.innerHTML = '<i class="bi bi-lightning-fill"></i> 快速添加示例训练';
                this.addMobileEventListener(quickStartBtn, 'click', () => this.addSampleExercises());
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
            alert('请先选择训练计划');
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

        samples.forEach(exercise => {
            storage.addExercise(this.currentPlanId, exercise);
        });

        this.currentExercises = storage.getExercises(this.currentPlanId);
        this.renderExercises();
        
        // 显示成功提示
        this.showToast('已添加3个示例训练项');
    }

    /**
     * 显示提示消息
     */
    showToast(message) {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 9999;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 2000);
    }

    // ==================== 数据导入导出 ====================

    /**
     * 导出数据
     */
    exportData() {
        const exportData = storage.exportData();
        
        if (!exportData) {
            alert('没有可导出的数据');
            return;
        }
        
        // 生成文件名（包含日期）
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0]; // 2026-01-09
        const fileName = `腰突康复训练_${dateStr}.json`;
        
        // 创建下载
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.showToast('数据导出成功！');
    }

    /**
     * 触发导入文件选择
     */
    triggerImport() {
        document.getElementById('importFile').click();
    }

    /**
     * 导入数据
     */
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 检查文件类型
        if (!file.name.endsWith('.json')) {
            alert('请选择JSON格式的文件');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                
                // 验证数据格式
                if (!importData || !importData.data || !importData.data.plans) {
                    throw new Error('数据格式不正确');
                }
                
                // 确认导入
                const planCount = importData.data.plans.length;
                const confirm = window.confirm(
                    `即将导入 ${planCount} 个训练计划。\n\n⚠️ 注意：这将覆盖当前所有数据！\n\n确定要继续吗？`
                );
                
                if (!confirm) {
                    return;
                }
                
                // 执行导入
                if (storage.importData(importData)) {
                    this.showToast('数据导入成功！');
                    this.loadPlans();
                } else {
                    throw new Error('导入失败');
                }
                
            } catch (error) {
                console.error('导入错误:', error);
                alert('导入失败：' + error.message);
            } finally {
                // 清空文件选择，允许重复导入同一文件
                event.target.value = '';
            }
        };
        
        reader.onerror = () => {
            alert('文件读取失败');
            event.target.value = '';
        };
        
        reader.readAsText(file);
    }

    /**
     * 创建训练项卡片
     */
    createExerciseCard(exercise, index) {
        const card = document.createElement('div');
        card.className = 'exercise-card';
        card.dataset.id = exercise.id;
        
        const typeClass = exercise.type === 'duration' ? 'type-duration' : 'type-reps';
        const typeText = exercise.type === 'duration' ? '持续时间型' : '次数型';
        
        let detailsHTML = '';
        if (exercise.type === 'duration') {
            detailsHTML = `
                <div class="detail-item">
                    <i class="bi bi-clock"></i>
                    <span>坚持 <span class="detail-value">${exercise.duration}秒</span></span>
                </div>
            `;
        } else {
            detailsHTML = `
                <div class="detail-item">
                    <i class="bi bi-arrow-repeat"></i>
                    <span>每组 <span class="detail-value">${exercise.reps}次</span></span>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="exercise-card-header">
                <h5 class="exercise-card-title">
                    <span class="exercise-card-number">${index + 1}</span>
                    ${exercise.name}
                </h5>
                <div class="exercise-card-actions">
                    <button class="card-action-btn edit" data-id="${exercise.id}">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="card-action-btn delete" data-id="${exercise.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            <span class="exercise-card-type ${typeClass}">${typeText}</span>
            <div class="exercise-card-details">
                ${detailsHTML}
                <div class="detail-item">
                    <i class="bi bi-layers"></i>
                    <span><span class="detail-value">${exercise.sets}组</span></span>
                </div>
                <div class="detail-item">
                    <i class="bi bi-hourglass-split"></i>
                    <span>组间休息 <span class="detail-value">${exercise.setRest}秒</span></span>
                </div>
            </div>
            ${exercise.description ? `<p class="exercise-card-description">${exercise.description}</p>` : ''}
        `;
        
        // 编辑按钮
        const editBtn = card.querySelector('.edit');
        if (editBtn) {
            this.addMobileEventListener(editBtn, 'click', () => {
                this.editExercise(exercise.id);
            });
        }
        
        // 删除按钮
        const deleteBtn = card.querySelector('.delete');
        if (deleteBtn) {
            this.addMobileEventListener(deleteBtn, 'click', () => {
                this.deleteExercise(exercise.id);
            });
        }
        
        return card;
    }

    /**
     * 显示训练项弹窗
     */
    showExerciseModal(exercise = null) {
        if (!this.currentPlanId) {
            alert('请先选择或创建一个训练计划');
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
        
        if (type === 'duration') {
            durationConfig.style.display = 'block';
            repsConfig.style.display = 'none';
        } else {
            durationConfig.style.display = 'none';
            repsConfig.style.display = 'block';
        }
    }

    /**
     * 保存训练项
     */
    saveExercise() {
        const name = document.getElementById('exerciseNameInput').value.trim();
        const type = document.querySelector('input[name="exerciseType"]:checked').value;
        const sets = parseInt(document.getElementById('sets').value);
        const setRest = parseInt(document.getElementById('setRest').value);
        const description = document.getElementById('description').value.trim();
        
        if (!name) {
            alert('请输入训练项名称');
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
            exercise.duration = parseInt(document.getElementById('duration').value);
        } else {
            exercise.reps = parseInt(document.getElementById('reps').value);
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
            alert('保存失败');
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
            if (storage.deleteExercise(this.currentPlanId, this.deleteTarget.id)) {
                this.currentExercises = storage.getExercises(this.currentPlanId);
                this.renderExercises();
            }
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
            alert('没有训练项');
            return;
        }
        
        const settings = storage.getSettings();
        const prepareTime = settings && settings.prepareTime ? settings.prepareTime : 10;
        trainingTimer.start(this.currentExercises, prepareTime);
    }

    /**
     * 显示训练界面
     */
    showTrainingView() {
        this.mainView.style.display = 'none';
        this.trainingView.style.display = 'flex';
    }

    /**
     * 显示主界面
     */
    showMainView() {
        this.trainingView.style.display = 'none';
        this.mainView.style.display = 'block';
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
        
        const radius = 120;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (progress / 100) * circumference;
        this.progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        this.progressCircle.style.strokeDashoffset = offset;
    }

    /**
     * 初始化进度圆环
     */
    initProgressCircle() {
        if (!this.progressCircle) return;
        
        const radius = 120;
        const circumference = 2 * Math.PI * radius;
        this.progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        this.progressCircle.style.strokeDashoffset = circumference;
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
    skipExercise() {
        if (confirm('确定要跳过当前训练项吗？')) {
            trainingTimer.skip();
        }
    }

    /**
     * 停止训练
     */
    stopTraining() {
        if (confirm('确定要结束训练吗？')) {
            trainingTimer.stop();
            this.showMainView();
        }
    }
}

// 页面加载完成后初始化应用
(function() {
    // 立即执行的代码，不等待DOMContentLoaded
    try {
        console.log('[main.js] 文件开始执行');
        window.showBasicError && window.showBasicError('main.js 文件已开始执行...');
    } catch(e) {
        console.error('[main.js] 执行错误:', e);
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('[main.js] DOMContentLoaded 事件触发');
        window.addDebugLog && window.addDebugLog('info', '开始初始化应用...');
        console.log('开始初始化应用...');
        
        // 显示可见提示
        window.showBasicError && window.showBasicError('正在初始化应用...');
        
        window.app = new RehabTrainerApp();
        
        window.addDebugLog && window.addDebugLog('success', '应用初始化完成');
        console.log('应用初始化完成');
        
        // 隐藏错误提示
        setTimeout(function() {
            var errorDiv = document.getElementById('basicErrorDisplay');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
        }, 2000);
        
        // 添加全局错误处理
        window.addEventListener('error', (event) => {
            const errorMsg = `全局错误: ${event.message}`;
            console.error(errorMsg, event.error);
            window.addDebugLog && window.addDebugLog('error', errorMsg, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error ? event.error.toString() : '未知错误'
            });
        });
        
        // 检测未捕获的Promise错误
        window.addEventListener('unhandledrejection', (event) => {
            const errorMsg = `未处理的Promise错误: ${event.reason}`;
            console.error(errorMsg);
            window.addDebugLog && window.addDebugLog('error', errorMsg, {
                reason: event.reason ? event.reason.toString() : '未知原因'
            });
        });
        
        // 检测是否在移动设备上
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const deviceInfo = isMobile ? '移动设备' : '桌面设备';
        console.log('设备类型:', deviceInfo);
        window.addDebugLog && window.addDebugLog('info', `设备类型: ${deviceInfo}`);
        
        // 测试按钮点击
        setTimeout(() => {
            const testBtn = document.getElementById('newPlanBtn');
            if (testBtn) {
                window.addDebugLog && window.addDebugLog('info', '准备测试按钮点击...');
                // 创建一个测试点击
                const testClick = () => {
                    window.addDebugLog && window.addDebugLog('info', '手动触发按钮点击测试');
                    testBtn.click();
                };
                // 5秒后自动测试（可选）
                // setTimeout(testClick, 5000);
            }
        }, 1000);
        
    } catch (error) {
        const errorMsg = `应用初始化失败: ${error.message}`;
        console.error('[main.js]', errorMsg, error);
        window.addDebugLog && window.addDebugLog('error', errorMsg, {
            stack: error.stack
        });
        
        // 显示可见的错误提示
        var detailedError = '应用初始化失败！\n\n错误信息：' + error.message + 
                          '\n\n堆栈信息：' + (error.stack || '无') +
                          '\n\n请截图此信息并检查：\n1. JavaScript文件是否有语法错误\n2. 浏览器控制台是否有更多错误';
        window.showBasicError && window.showBasicError(detailedError);
        
        alert('应用初始化失败：' + error.message + '\n\n页面顶部已显示详细错误信息\n请查看调试面板获取更多信息（点击左下角🐛图标3次）');
    }
});

// 如果DOMContentLoaded已经触发过了，立即执行
if (document.readyState === 'loading') {
    // DOM还在加载中，等待DOMContentLoaded
    console.log('[main.js] 等待DOMContentLoaded...');
} else {
    // DOM已经加载完成，立即执行
    console.log('[main.js] DOM已加载，立即执行初始化...');
    document.dispatchEvent(new Event('DOMContentLoaded'));
}
