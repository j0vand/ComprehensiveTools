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
        this.initDragAndDrop();
        this.loadVoiceSettings();
        this.checkAndDisplayVoiceSupport();
        
        // 所有设备都需要用户交互后才能使用TTS（浏览器安全限制）
        this.initVoiceOnFirstInteraction();
    }

    /**
     * 检测是否为iOS设备
     */
    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
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
        const browserName = this.getBrowserName();
        
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
                window.speechSynthesis.addEventListener('voiceschanged', checkChineseVoices, { once: true });
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
            
            if (browserName) {
                message += `<br><small>当前浏览器：${browserName}</small>`;
            }
            
            this.voiceStatusText.innerHTML = message;
            this.voiceStatusBar.style.display = 'block';
        }
    }

    /**
     * 获取浏览器名称
     */
    getBrowserName() {
        const ua = navigator.userAgent;
        if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) return 'Chrome';
        if (ua.indexOf('Edg') > -1) return 'Edge';
        if (ua.indexOf('Firefox') > -1) return 'Firefox';
        if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) return 'Safari';
        if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) return 'Opera';
        if (ua.indexOf('MSIE') > -1 || ua.indexOf('Trident') > -1) return 'Internet Explorer';
        return '未知浏览器';
    }

    /**
     * 首次交互时初始化语音（浏览器安全限制：需要用户交互才能播放语音）
     */
    initVoiceOnFirstInteraction() {
        let voiceInitialized = false;
        
        const initVoice = () => {
            if (voiceInitialized) return;
            voiceInitialized = true;
            
            // 测试语音功能是否可用
            try {
                // 使用一个很短的测试语音来激活TTS引擎
                const testUtterance = new SpeechSynthesisUtterance('');
                testUtterance.volume = 0.01; // 几乎静音
                testUtterance.rate = 10; // 极快，几乎瞬间完成
                window.speechSynthesis.speak(testUtterance);
                
                // 立即停止，这只是为了激活TTS引擎
                setTimeout(() => {
                    window.speechSynthesis.cancel();
                }, 10);
            } catch (error) {
                console.warn('语音初始化失败:', error);
            }
        };
        
        // 监听多种用户交互事件
        const events = ['touchstart', 'click', 'mousedown', 'keydown'];
        events.forEach(eventType => {
            document.addEventListener(eventType, initVoice, { once: true, passive: true });
        });
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
            console.error(`元素不存在: ${event}`);
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
                    handler(e);
                };
                
                element.addEventListener('touchstart', touchHandler, { passive: false });
                
                // 同时保留click作为备用
                element.addEventListener('click', handler);
            } else {
                // 桌面端：只使用click
                element.addEventListener('click', handler);
            }
        } catch (error) {
            console.error(`绑定事件监听器失败: ${element.id || element.className}`, error);
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

            // 释放屏幕常亮
            if (typeof screenWakeLock !== 'undefined' && 'wakeLock' in navigator) {
                screenWakeLock.release();
            }
        });
        
        // 完成
        trainingTimer.on('complete', () => {
            voiceManager.announceComplete();

            // 释放屏幕常亮
            if (typeof screenWakeLock !== 'undefined' && 'wakeLock' in navigator) {
                screenWakeLock.release();
            }

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
                
                // 获取当前计划列表
                const currentPlans = storage.getAllPlans();
                const importPlans = importData.data.plans;
                const planCount = importPlans.length;
                
                // 检查是否有同名计划
                const existingPlanNames = currentPlans.map(p => p.name);
                const importPlanNames = importPlans.map(p => p.name);
                const duplicateNames = importPlanNames.filter(name => existingPlanNames.includes(name));
                const newPlanNames = importPlanNames.filter(name => !existingPlanNames.includes(name));
                
                // 构建确认消息
                let confirmMessage = `即将导入 ${planCount} 个训练计划。\n\n`;
                
                if (duplicateNames.length > 0) {
                    confirmMessage += `⚠️ 以下 ${duplicateNames.length} 个计划已存在，将被覆盖：\n`;
                    duplicateNames.forEach(name => {
                        confirmMessage += `  • ${name}\n`;
                    });
                    confirmMessage += '\n';
                }
                
                if (newPlanNames.length > 0) {
                    confirmMessage += `✅ 以下 ${newPlanNames.length} 个计划将新增：\n`;
                    newPlanNames.forEach(name => {
                        confirmMessage += `  • ${name}\n`;
                    });
                    confirmMessage += '\n';
                }
                
                confirmMessage += '确定要继续吗？';
                
                const confirm = window.confirm(confirmMessage);
                
                if (!confirm) {
                    return;
                }
                
                // 执行导入（智能合并模式）
                const result = storage.importData(importData, true);
                
                if (result && result.success) {
                    let message = '数据导入成功！';
                    if (result.added > 0 || result.updated > 0) {
                        message += `\n新增 ${result.added} 个计划，更新 ${result.updated} 个计划`;
                    }
                    this.showToast(message);
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
        card.draggable = true; // 启用拖拽功能
        
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
            editBtn.draggable = false; // 按钮不可拖拽
            this.addMobileEventListener(editBtn, 'click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                this.editExercise(exercise.id);
            });
        }
        
        // 删除按钮
        const deleteBtn = card.querySelector('.delete');
        if (deleteBtn) {
            deleteBtn.draggable = false; // 按钮不可拖拽
            this.addMobileEventListener(deleteBtn, 'click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
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
        
        // 确保语音设置已加载
        this.loadVoiceSettings();
        
        // 确保语音功能已启用
        if (voiceManager && 'speechSynthesis' in window) {
            voiceManager.setEnabled(true);
        }
        
        const settings = storage.getSettings();
        const prepareTime = settings && settings.prepareTime ? settings.prepareTime : 10;

        // 激活屏幕常亮
        if (typeof screenWakeLock !== 'undefined' && 'wakeLock' in navigator) {
            screenWakeLock.request();
        }

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

            // 释放屏幕常亮
            if (typeof screenWakeLock !== 'undefined' && 'wakeLock' in navigator) {
                screenWakeLock.release();
            }

            this.showMainView();
        }
    }

    /**
     * 初始化拖拽排序功能
     */
    initDragAndDrop() {
        if (!this.exerciseList) return;

        // 使用事件委托，监听整个列表容器
        this.exerciseList.addEventListener('dragstart', (e) => this.handleDragStart(e));
        this.exerciseList.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.exerciseList.addEventListener('drop', (e) => this.handleDrop(e));
        this.exerciseList.addEventListener('dragend', (e) => this.handleDragEnd(e));
        
        // 移动端触摸拖拽支持
        this.initTouchDrag();
    }
    
    /**
     * 初始化触摸拖拽（移动端支持）
     */
    initTouchDrag() {
        let draggedElement = null;
        let placeholder = null;
        let touchStartY = 0;
        let touchStartX = 0;
        let draggedIndex = 0;
        let isDragging = false;
        const DRAG_THRESHOLD = 10; // 拖拽阈值，超过这个距离才认为是拖拽
        
        this.exerciseList.addEventListener('touchstart', (e) => {
            // 如果点击的是按钮，不处理
            if (e.target.closest('button')) {
                return;
            }
            
            const card = e.target.closest('.exercise-card');
            if (!card) return;
            
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
            draggedElement = card;
            draggedIndex = Array.from(this.exerciseList.children).indexOf(card);
            isDragging = false;
        }, { passive: true });
        
        this.exerciseList.addEventListener('touchmove', (e) => {
            if (!draggedElement) return;
            
            const touchY = e.touches[0].clientY;
            const touchX = e.touches[0].clientX;
            const deltaY = Math.abs(touchY - touchStartY);
            const deltaX = Math.abs(touchX - touchStartX);
            
            // 如果垂直移动距离大于水平移动距离，且超过阈值，开始拖拽
            if (!isDragging && deltaY > DRAG_THRESHOLD && deltaY > deltaX) {
                isDragging = true;
                e.preventDefault();
                
                // 创建占位符
                placeholder = document.createElement('div');
                placeholder.className = 'exercise-card-placeholder';
                placeholder.style.cssText = `
                    height: ${draggedElement.offsetHeight}px;
                    background: #e9ecef;
                    border: 2px dashed #0d6efd;
                    border-radius: 12px;
                    margin-bottom: 1rem;
                    transition: none;
                `;
                
                draggedElement.style.opacity = '0.5';
                draggedElement.style.position = 'relative';
                draggedElement.style.zIndex = '1000';
                draggedElement.parentNode.insertBefore(placeholder, draggedElement);
            }
            
            if (isDragging && placeholder) {
                e.preventDefault();
                const currentY = touchY;
                const delta = currentY - touchStartY;
                
                // 移动卡片
                draggedElement.style.transform = `translateY(${delta}px)`;
                
                // 计算应该插入的位置
                const allCards = Array.from(this.exerciseList.querySelectorAll('.exercise-card'));
                const placeholderIndex = Array.from(this.exerciseList.children).indexOf(placeholder);
                let targetIndex = placeholderIndex;
                
                allCards.forEach((card, index) => {
                    if (card === draggedElement) return;
                    
                    const rect = card.getBoundingClientRect();
                    const cardCenter = rect.top + rect.height / 2;
                    
                    if (currentY < cardCenter && index < placeholderIndex) {
                        targetIndex = index;
                    } else if (currentY > cardCenter && index > placeholderIndex) {
                        targetIndex = index + 1;
                    }
                });
                
                // 移动占位符到目标位置
                const allChildren = Array.from(this.exerciseList.children);
                if (allChildren[targetIndex] !== placeholder && targetIndex !== placeholderIndex) {
                    this.exerciseList.insertBefore(placeholder, allChildren[targetIndex] || null);
                }
            }
        }, { passive: false });
        
        this.exerciseList.addEventListener('touchend', () => {
            if (!isDragging || !draggedElement || !placeholder) {
                draggedElement = null;
                placeholder = null;
                isDragging = false;
                return;
            }
            
            // 获取最终顺序
            const allCards = Array.from(this.exerciseList.querySelectorAll('.exercise-card'));
            const placeholderIndex = Array.from(this.exerciseList.children).indexOf(placeholder);
            
            // 移除占位符
            placeholder.remove();
            
            // 重置样式
            draggedElement.style.opacity = '';
            draggedElement.style.transform = '';
            draggedElement.style.position = '';
            draggedElement.style.zIndex = '';
            
            // 获取新的顺序ID数组
            const exerciseIds = [];
            allCards.forEach(card => {
                if (card !== draggedElement) {
                    exerciseIds.push(card.dataset.id);
                }
            });
            
            // 将拖拽的元素插入到占位符位置
            exerciseIds.splice(placeholderIndex, 0, draggedElement.dataset.id);
            
            // 保存新顺序
            if (this.currentPlanId && exerciseIds.length > 0) {
                if (storage.reorderExercises(this.currentPlanId, exerciseIds)) {
                    this.currentExercises = storage.getExercises(this.currentPlanId);
                    this.renderExercises();
                    this.showToast('顺序已更新');
                }
            }
            
            // 重置变量
            draggedElement = null;
            placeholder = null;
            isDragging = false;
        });
    }

    /**
     * 处理拖拽开始事件
     */
    handleDragStart(e) {
        const targetCard = e.target.closest('.exercise-card');
        if (!targetCard) {
            e.preventDefault();
            return;
        }

        // 如果点击的是按钮，不触发拖拽
        if (e.target.closest('button')) {
            e.preventDefault();
            return;
        }

        // 设置拖拽反馈样式
        targetCard.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', targetCard.dataset.id);
    }

    /**
     * 处理拖拽移动事件
     */
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const targetCard = e.target.closest('.exercise-card');
        const draggableCard = document.querySelector('.exercise-card.dragging');

        // 移除所有拖拽悬停样式
        document.querySelectorAll('.exercise-card.drag-over').forEach(card => {
            if (card !== targetCard) {
                card.classList.remove('drag-over');
            }
        });

        if (targetCard && draggableCard && targetCard !== draggableCard) {
            // 添加视觉反馈
            targetCard.classList.add('drag-over');
            
            // 计算插入位置
            const rect = targetCard.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            const mouseY = e.clientY;
            
            // 根据鼠标位置决定插入到上方还是下方
            if (mouseY < midpoint) {
                targetCard.classList.add('drag-over-top');
                targetCard.classList.remove('drag-over-bottom');
            } else {
                targetCard.classList.add('drag-over-bottom');
                targetCard.classList.remove('drag-over-top');
            }
        }
    }

    /**
     * 处理放置事件
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();

        // 移除视觉反馈
        document.querySelectorAll('.exercise-card.drag-over, .exercise-card.drag-over-top, .exercise-card.drag-over-bottom').forEach(card => {
            card.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });

        const targetCard = e.target.closest('.exercise-card');
        const draggedId = e.dataTransfer.getData('text/plain');

        // 不能放置到自身
        if (!targetCard || targetCard.dataset.id === draggedId) {
            return;
        }

        // 获取当前所有卡片的ID顺序（按DOM顺序）
        const allCards = Array.from(this.exerciseList.querySelectorAll('.exercise-card'));
        const exerciseIds = allCards.map(card => card.dataset.id);

        // 找到拖拽元素和目标元素的索引
        const draggedIndex = exerciseIds.indexOf(draggedId);
        const targetIndex = exerciseIds.indexOf(targetCard.dataset.id);

        // 如果索引无效，直接返回
        if (draggedIndex === -1 || targetIndex === -1) {
            return;
        }

        // 重新排列数组
        exerciseIds.splice(draggedIndex, 1);
        exerciseIds.splice(targetIndex, 0, draggedId);

        // 保存新顺序到存储
        if (this.currentPlanId && storage.reorderExercises(this.currentPlanId, exerciseIds)) {
            // 更新内存中的数据顺序
            this.currentExercises = storage.getExercises(this.currentPlanId);
            // 重新渲染以更新序号
            this.renderExercises();
            // 显示成功提示
            this.showToast('顺序已更新');
        }
    }

    /**
     * 处理拖拽结束事件
     */
    handleDragEnd() {
        // 移除所有拖拽相关样式
        document.querySelectorAll('.exercise-card.dragging, .exercise-card.drag-over, .exercise-card.drag-over-top, .exercise-card.drag-over-bottom')
            .forEach(card => {
                card.classList.remove('dragging', 'drag-over', 'drag-over-top', 'drag-over-bottom');
            });
    }

}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new RehabTrainerApp();
    } catch (error) {
        console.error('应用初始化失败:', error);
        alert('应用初始化失败：' + error.message + '\n请刷新页面重试。');
    }
});

// 如果DOMContentLoaded已经触发过了，立即执行
if (document.readyState !== 'loading') {
    document.dispatchEvent(new Event('DOMContentLoaded'));
}
