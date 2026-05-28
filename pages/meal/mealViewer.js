        /**
         * 今日点餐查看器
         * 用于管理和查看每日三餐安排
         * @module MealViewer
         */

        /**
         * 餐食安排数据结构
         * @class MealArrangement
         */
        class MealArrangement {
            /**
             * @param {Date} date - 日期
             * @param {string} mealTime - 用餐时间（早餐/午餐/晚餐）
             * @param {number} number - 人数
             * @param {string} content - 菜品内容
             * @param {string} owner - 负责人
             */
            constructor(date, mealTime, number, content, owner) {
                this.date = date;
                this.mealTime = mealTime;
                this.number = number;
                this.content = content;
                this.owner = owner; // 记录归属：'mine' 或 'others'
                this.id = Date.now() + Math.random().toString(36).substr(2, 9); // 添加唯一ID
                
                // 添加原始日期字符串和解析后的日期对象
                this.rawDate = date; // 保存原始输入的日期字符串
                this.dateObj = parseDateString(date); // 存储解析后的日期对象
            }
        }

        const weekDayMap = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0};
        const reverseWeekDayMap = ['日', '一', '二', '三', '四', '五', '六'];

        const MEAL_STORAGE_KEY = (window.StorageKeys && window.StorageKeys.MEAL_VIEWER_DATA) || 'mealArrangements';

        /**
         * 从粘贴文本的头部日期范围自动判断是本周还是下周
         * 支持格式：
         *   - "4月13日-4月17日" / "4月13日-4月17日用餐收集"
         *   - "4.13-4.17"
         *   - "04.13-04.17"
         * @returns {{ isNextWeek: boolean, startDate: Date|null, endDate: Date|null }}
         */
        function detectWeekFromHeader(text) {
            const lines = text.split('\n').slice(0, 5); // 只看前5行
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            for (const line of lines) {
                let startMonth, startDay, endMonth, endDay;

                // 匹配 "X月X日-X月X日" 或 "X月X日～X月X日"
                const fullMatch = line.match(/(\d{1,2})月(\d{1,2})日\s*[-~～至]\s*(\d{1,2})月(\d{1,2})日/);
                if (fullMatch) {
                    [, startMonth, startDay, endMonth, endDay] = fullMatch.map(Number);
                }

                // 匹配 "X.X-X.X" 或 "0X.0X-0X.0X"
                if (!startMonth) {
                    const dotMatch = line.match(/(\d{1,2})\.(\d{1,2})\s*[-~～]\s*(\d{1,2})\.(\d{1,2})/);
                    if (dotMatch) {
                        [, startMonth, startDay, endMonth, endDay] = dotMatch.map(Number);
                    }
                }

                if (startMonth && startDay) {
                    const year = now.getFullYear();
                    const rangeStart = new Date(year, startMonth - 1, startDay);
                    const rangeEnd = endMonth ? new Date(year, endMonth - 1, endDay) : rangeStart;

                    // 如果范围的起始日期在今天之后（超过1天），判定为下周
                    const diffDays = Math.floor((rangeStart - today) / (1000 * 60 * 60 * 24));
                    const isNextWeek = diffDays > 2;

                    return { isNextWeek, startDate: rangeStart, endDate: rangeEnd };
                }
            }

            return { isNextWeek: false, startDate: null, endDate: null };
        }

        // 格式化日期对象为 "M月D日-周X" 字符串
        function formatDate(dateObj) {
            const month = dateObj.getMonth() + 1;
            const day = dateObj.getDate();
            const weekDayChar = reverseWeekDayMap[dateObj.getDay()];
            return `${month}月${day}日-周${weekDayChar}`;
        }

        // HTML内容安全转义函数
        function escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // 获取今天的日期格式化字符串
        function getTodayFormats() {
            const now = new Date();
            const weekDay = reverseWeekDayMap[now.getDay()];
            return {
                date: now,
                fullDate: `${now.getMonth() + 1}月${now.getDate()}日`,
                weekDay: `周${weekDay}`,
                fullWeekDay: `星期${weekDay}`,
                formats: [`${now.getMonth() + 1}月${now.getDate()}日`, `周${weekDay}`, `星期${weekDay}`],
                timeStr: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
            };
        }

        // 标准化日期格式
        function standardizeDate(dateStr, forNextWeek = false) {
            // 解析输入的日期格式
            const now = new Date();
            const currentWeekDay = now.getDay(); // 0-6，周日是0
            
            // 匹配"周X"或"星期X"格式
            const weekDayMatch = dateStr.match(/[周星期]([一二三四五六日])/);
            if (weekDayMatch) {
                const weekDay = weekDayMatch[1];
                const dayNumber = weekDayMap[weekDay]; // 获取对应的数字，周一是1
                
                let targetDate = new Date();
                // 计算目标日期与当前日期的差值
                let diff = dayNumber - currentWeekDay;
                
                // 如果是周日 (0) 并且目标是工作日 (1-6)
                if (currentWeekDay === 0 && dayNumber > 0) {
                    // 如果是当前周，就是这周的工作日
                    diff = dayNumber;
                } 
                // 如果是工作日，目标是周日 (0)
                else if (currentWeekDay > 0 && dayNumber === 0) {
                    // 周日总是在本周结束，即6天后
                    diff = 7 - currentWeekDay;
                }
                
                // 修复：不再在此处对过去日期进行调整，统一在下面根据forNextWeek处理
                // else if (diff < 0 && forNextWeek) {
                //     diff += 7; // 只有在选择下周时才将负差值调整为下周
                // }
                
                // 如果是下周，计算准确的下周日期
                if (forNextWeek) {
                    // 如果差值小于0，表示是本周过去的日期，需要加7变成下周
                    // 如果差值大于等于0，表示是本周未来或今天的日期，也加7变成下周
                    // 这样处理就能保证无论如何都只是下一周，而不会是下下周
                    diff += 7;
                }
                
                targetDate.setDate(now.getDate() + diff);
                
                // 格式化为标准格式: 月日-周X
                const month = targetDate.getMonth() + 1;
                const day = targetDate.getDate();
                const weekDayChar = reverseWeekDayMap[targetDate.getDay()];
                
                return `${month}月${day}日-周${weekDayChar}`;
            }
            
            // 处理"X月X日"格式
            const dateMatch = dateStr.match(/(\d+)月(\d+)日/);
            if (dateMatch) {
                const month = parseInt(dateMatch[1]);
                const day = parseInt(dateMatch[2]);
                
                // 创建日期对象
                let targetDate = new Date(now.getFullYear(), month - 1, day);
                
                // 处理年份跨越问题
                if (targetDate < now && !forNextWeek) {
                    if (month > now.getMonth() + 1) {
                        // 如果月份大于当前月份但日期已过，可能是去年的日期
                        targetDate.setFullYear(now.getFullYear() - 1);
                    }
                } else if (targetDate > now && month < now.getMonth() + 1) {
                    // 如果月份小于当前月份但日期未到，可能是明年的日期
                    targetDate.setFullYear(now.getFullYear() + 1);
                }
                
                // 如果是下周，加7天
                if (forNextWeek) {
                    targetDate.setDate(targetDate.getDate() + 7);
                }
                
                // 格式化为标准格式: 月日-周X
                const resultMonth = targetDate.getMonth() + 1;
                const resultDay = targetDate.getDate();
                const weekDayChar = reverseWeekDayMap[targetDate.getDay()];
                
                return `${resultMonth}月${resultDay}日-周${weekDayChar}`;
            }
            
            // 如果是其他格式，直接返回原始字符串
            return dateStr;
        }

        // 日期格式验证函数
        function isValidDateFormat(dateStr) {
            if (!dateStr) return false;
            
            // 检查"X月X日"格式
            const dateMatch = dateStr.match(/(\d+)月(\d+)日/);
            if (dateMatch) {
                const month = parseInt(dateMatch[1]);
                const day = parseInt(dateMatch[2]);
                return month >= 1 && month <= 12 && day >= 1 && day <= 31;
            }
            
            // 检查"周X"或"星期X"格式
            const weekDayMatch = dateStr.match(/[周星期]([一二三四五六日])/);
            if (weekDayMatch) {
                return true;
            }
            
            // 检查特殊格式如"X月X日-周X"
            const combinedMatch = dateStr.match(/\d+月\d+日-周[一二三四五六日]/);
            if (combinedMatch) {
                return true;
            }
            
            return false;
        }

        // 统一的日期解析函数
        function parseDateString(dateStr) {
            if (!dateStr) return null;
            
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const currentDay = now.getDay(); // 使用标准的0-6表示
            
            // 尝试匹配"X月X日"格式
            const dateMatch = dateStr.match(/(\d+)月(\d+)日/);
            if (dateMatch) {
                const month = parseInt(dateMatch[1]);
                const day = parseInt(dateMatch[2]);
                
                // 创建日期对象，处理跨年情况
                let dateObj = new Date(today.getFullYear(), month - 1, day);
                
                // 如果日期已过，但月份大于当前月份，可能是去年的日期
                if (dateObj < today && month > now.getMonth() + 1) {
                    dateObj.setFullYear(today.getFullYear() - 1);
                }
                
                // 如果日期未到，但月份小于当前月份，可能是明年的日期
                if (dateObj > today && month < now.getMonth() + 1) {
                    dateObj.setFullYear(today.getFullYear() + 1);
                }
                
                return dateObj;
            }
            
            // 尝试匹配"周X"或"星期X"格式
            const weekDayMatch = dateStr.match(/[周星期]([一二三四五六日])/);
            if (weekDayMatch) {
                const weekDay = weekDayMatch[1];
                const targetDay = weekDayMap[weekDay];
                
                // 计算当周对应星期几的日期
                let diff = targetDay - currentDay;
                
                // 修改：不再自动将过去的日期调整为当天
                // if (diff < 0) diff = 0;
                
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + diff);
                
                return targetDate;
            }
            
            // 尝试匹配组合格式如"X月X日-周X"
            const combinedMatch = dateStr.match(/(\d+)月(\d+)日-周([一二三四五六日])/);
            if (combinedMatch) {
                const month = parseInt(combinedMatch[1]);
                const day = parseInt(combinedMatch[2]);
                
                let dateObj = new Date(today.getFullYear(), month - 1, day);
                return dateObj;
            }
            
            return null;
        }

        // 处理输入的订餐数据
        function processMealData() {
            try {
                const input = document.getElementById('mealInput').value;
                const quickNumbersInput = document.getElementById('quickMealNumbers').value;

                if (!input.trim() && !quickNumbersInput.trim()) {
                    showToast('请输入订餐内容或快捷序号', 'error');
                    return;
                }
                
                const owner = document.querySelector('input[name="mealOwner"]:checked').value;
                // 自动检测是否为下周，不再依赖手动勾选
                const headerInfo = detectWeekFromHeader(input);
                const saveForNextWeek = headerInfo.isNextWeek;

                // 更新UI提示
                const weekHintEl = document.getElementById('weekDetectHint');
                if (weekHintEl) {
                    if (headerInfo.startDate) {
                        const label = saveForNextWeek ? '下周' : '本周';
                        weekHintEl.textContent = `已自动识别为「${label}」的记录`;
                        weekHintEl.style.color = saveForNextWeek ? '#f59e0b' : '#10b981';
                        weekHintEl.style.display = 'block';
                    } else {
                        weekHintEl.style.display = 'none';
                    }
                }

                const lines = input.split('\n').filter(line => line.trim());
                const meals = [];
                
                // 1. 处理详细输入框
                if (input.trim()) {
                    // 当前正在处理的日期上下文（周几）
                    let currentWeekDay = null;

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();

                        // 跳过纯数字行（序号行如 "01*"、"02"）
                        if (/^\d{1,3}\*?$/.test(line)) continue;
                        // 跳过头部信息行（日期范围、提交信息、配送楼层等）
                        if (/用餐收集|已提交|最后提交|配送楼层|^\d+\.\d+\s*[-~]/.test(line)) continue;

                        // === 新格式：【周X午餐】或【周X晚餐】===
                        const combinedBracketMatch = line.match(/【(周[一二三四五六日])(午餐|晚餐)】/);
                        if (combinedBracketMatch) {
                            currentWeekDay = combinedBracketMatch[1];
                            const mealTime = combinedBracketMatch[2];

                            if (owner === 'others' && mealTime === '午餐') {
                                currentWeekDay = null; // 重置，跳过他人午餐
                                continue;
                            }

                            // 下一行应该是 "午餐N:内容" 或 "晚餐N:内容"
                            if (i + 1 < lines.length) {
                                const nextLine = lines[i + 1].trim();
                                const numberMatch = nextLine.match(/[午晚]餐(\d+)\s*[:：]\s*/);
                                if (numberMatch) {
                                    const standardizedDate = standardizeDate(currentWeekDay, saveForNextWeek);
                                    if (!isValidDateFormat(standardizedDate)) {
                                        console.warn('标准化后的日期格式不正确:', standardizedDate);
                                        continue;
                                    }
                                    const number = numberMatch[1];
                                    const content = nextLine.replace(/[午晚]餐\d+\s*[:：]\s*/, '').trim();
                                    if (!content) {
                                        console.warn('无法解析餐点内容:', nextLine);
                                        continue;
                                    }
                                    meals.push(new MealArrangement(standardizedDate, mealTime, number, content, owner));
                                    i++; // 已消费下一行
                                }
                            }
                            continue;
                        }

                        // === 旧格式兼容：【周X】或【X月X日】（日期和餐点分开的行）===
                        if (line.includes('【') && line.includes('】')) {
                            const dateMatch = line.match(/【(.+?)】/);
                            if (dateMatch && i + 1 < lines.length) {
                                let originalDate = dateMatch[1];
                                const nextLine = lines[i + 1].trim();
                                
                                const numberMatch = nextLine.match(/[午晚]餐(\d+)\s*[:：\s]/);
                                const mealTime = nextLine.includes('午餐') ? '午餐' : '晚餐';

                                if (owner === 'others' && mealTime === '午餐') {
                                    continue;
                                }
                                
                                if (numberMatch) {
                                    const standardizedDate = standardizeDate(originalDate, saveForNextWeek);
                                    
                                    if (!isValidDateFormat(standardizedDate)) {
                                        console.warn('标准化后的日期格式不正确:', standardizedDate);
                                        continue;
                                    }
                                    
                                    const number = numberMatch[1];
                                    const content = nextLine.replace(/[午晚]餐\d+\s*[:：\s]\s*/, '').trim();
                                    
                                    if (!content) {
                                        console.warn('无法解析餐点内容:', nextLine);
                                        continue;
                                    }
                                    
                                    meals.push(new MealArrangement(standardizedDate, mealTime, number, content, owner));
                                    i++; // 已消费下一行
                                }
                            }
                        }
                    }
                }

                // 2. 处理快捷录入序号
                if (quickNumbersInput.trim()) {
                    const numbers = quickNumbersInput.match(/\d+/g);
                    if (numbers && numbers.length > 0) {
                        let startDate = new Date();
                        startDate.setHours(0, 0, 0, 0);

                        // 快捷录入没有头部日期范围，判断逻辑：
                        // 如果今天是周五/周六/周日，默认下周一开始；否则明天开始
                        const dayOfWeek = startDate.getDay();
                        if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
                            const daysUntilNextMonday = (dayOfWeek === 0) ? 1 : (8 - dayOfWeek);
                            startDate.setDate(startDate.getDate() + daysUntilNextMonday);
                        } else {
                            startDate.setDate(startDate.getDate() + 1);
                        }

                        for (let i = 0; i < numbers.length; i++) {
                            const targetDate = new Date(startDate);
                            targetDate.setDate(startDate.getDate() + i);
                            const formattedDate = formatDate(targetDate);
                            const number = numbers[i];
                            meals.push(new MealArrangement(formattedDate, '晚餐', number, '快捷录入', 'others'));
                        }
                    }
                }
                
                if (meals.length === 0) {
                    showToast('未能识别任何有效的订餐安排，请检查格式', 'error');
                    return;
                }

                // 获取现有安排并删除过期安排
                let existingArrangements;
                if (window.CommonUtils && window.CommonUtils.getLocalStorageItem) {
                    existingArrangements = window.CommonUtils.getLocalStorageItem(MEAL_STORAGE_KEY, []);
                } else {
                    existingArrangements = JSON.parse(localStorage.getItem(MEAL_STORAGE_KEY) || '[]');
                }
                
                // 合并新旧安排
                const allArrangements = [...existingArrangements, ...meals];

                let finalArrangements = removeExpiredArrangements(allArrangements);

                // 检查数据大小，避免超出localStorage限制
                try {
                    const dataString = JSON.stringify(finalArrangements);
                    if (dataString.length > 4000000) { // 设置安全限制
                        throw new Error("数据量过大，请清理部分历史安排");
                    }
                    if (window.CommonUtils && window.CommonUtils.setLocalStorageItem) {
                        window.CommonUtils.setLocalStorageItem(MEAL_STORAGE_KEY, finalArrangements);
                    } else {
                        localStorage.setItem(MEAL_STORAGE_KEY, dataString);
                    }
                    
                    // 清空输入
                    document.getElementById('mealInput').value = '';
                    document.getElementById('quickMealNumbers').value = '';
                    const weekHintReset = document.getElementById('weekDetectHint');
                    if (weekHintReset) weekHintReset.style.display = 'none';
                    
                    // 刷新显示
                    displayMeals();
                    displayTodayMeals();
                    
                    // 使用非阻塞方式显示成功消息
                    showToast(`成功添加了 ${meals.length} 条安排`, 'success');
                } catch (e) {
                    showToast('保存失败: ' + e.message, 'error');
                    console.error('保存安排失败', e);
                }
            } catch (e) {
                showToast('处理订餐数据时出错：' + e.message, 'error');
                console.error('处理订餐数据出错', e);
            }
        }

        // 删除过期安排
        function removeExpiredArrangements(arrangements) {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const lunchEndTime = 13 * 60; // 13:00
            const dinnerEndTime = 19 * 60 + 20; // 19:20
            
            return arrangements.filter(arrangement => {
                try {
                    // 尝试解析日期字符串
                    let dateObj = parseDateString(arrangement.date);
                    
                    // 如果无法解析日期，保留安排并记录警告
                    if (!dateObj) {
                        console.warn('无法解析日期格式:', arrangement.date);
                        return true;
                    }
                    
                    // 如果是过去的日期，删除
                    if (dateObj < today) {
                        return false;
                    }
                    
                    // 如果是今天的安排，根据时间判断
                    if (dateObj.getTime() === today.getTime()) {
                        if (arrangement.mealTime === '午餐' && currentTime > lunchEndTime) {
                            return false;
                        }
                        if (arrangement.mealTime === '晚餐' && currentTime > dinnerEndTime) {
                            return false;
                        }
                    }
                    
                    return true;
                } catch (e) {
                    console.error('处理安排时出错:', e, arrangement);
                    return true; // 出错时保留安排
                }
            });
        }

        // 显示所有订餐安排，并隐藏过期安排
        function displayMeals() {
            try {
                let arrangements;
                if (window.CommonUtils && window.CommonUtils.getLocalStorageItem) {
                    arrangements = window.CommonUtils.getLocalStorageItem(MEAL_STORAGE_KEY, []);
                } else {
                    arrangements = JSON.parse(localStorage.getItem(MEAL_STORAGE_KEY) || '[]');
                }

                // 删除过期安排
                const filteredArrangements = removeExpiredArrangements(arrangements);
                
                // 如果有安排被过滤掉，保存更新后的安排
                if (filteredArrangements.length !== arrangements.length) {
                    if (window.CommonUtils && window.CommonUtils.setLocalStorageItem) {
                        window.CommonUtils.setLocalStorageItem(MEAL_STORAGE_KEY, filteredArrangements);
                    } else {
                        localStorage.setItem(MEAL_STORAGE_KEY, JSON.stringify(filteredArrangements));
                    }
                    console.log(`已清理 ${arrangements.length - filteredArrangements.length} 条过期安排`);
                }
                
                // 使用过滤后的安排
                arrangements = filteredArrangements;
                
                // 过滤掉今天的安排，因为它们已经在"今日餐点"部分显示了
                const todayInfo = getTodayFormats();
                
                arrangements = arrangements.filter(arrangement => {
                    // 尝试解析日期
                    const dateObj = parseDateString(arrangement.date);
                    if (!dateObj) return true; // 如果无法解析，保留
                    
                    const today = new Date(todayInfo.date.getFullYear(), todayInfo.date.getMonth(), todayInfo.date.getDate());
                    
                    // 如果日期就是今天，则过滤掉
                    return dateObj.getTime() !== today.getTime();
                });
                
                // 按日期和时间排序
                arrangements.sort((a, b) => {
                    // 尝试解析日期
                    const dateA = parseDateString(a.date);
                    const dateB = parseDateString(b.date);
                    
                    // 如果都能解析为日期对象
                    if (dateA && dateB) {
                        if (dateA.getTime() !== dateB.getTime()) {
                            return dateA - dateB;
                        }
                    } else {
                        // fallback到字符串比较
                        if (a.date !== b.date) {
                            return a.date.localeCompare(b.date);
                        }
                    }
                    
                    // 日期相同时，午餐排在晚餐前面
                    return a.mealTime === '午餐' ? -1 : 1;
                });

                // 渲染订餐安排
                renderArrangements(arrangements);
            } catch (e) {
                console.error('显示安排时出错:', e);
                document.getElementById('mealHistory').innerHTML = 
                    `<div style="color: red; text-align: center; padding: 20px;">
                        显示安排时出错: ${escapeHtml(e.message)}
                    </div>`;
            }
        }

        // 渲染订餐安排
        function renderArrangements(arrangements) {
            const historyDiv = document.getElementById('mealHistory');
            historyDiv.innerHTML = '';

            if (arrangements.length === 0) {
                historyDiv.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">暂无安排</div>';
                return;
            }

            // 按日期分组
            const arrangementsByDate = {};
            arrangements.forEach(arrangement => {
                if (!arrangementsByDate[arrangement.date]) {
                    arrangementsByDate[arrangement.date] = [];
                }
                arrangementsByDate[arrangement.date].push(arrangement);
            });

            // 遍历每个日期组
            Object.keys(arrangementsByDate).sort((a, b) => {
                const dateA = parseDateString(a);
                const dateB = parseDateString(b);
                if (dateA && dateB) {
                    return dateA - dateB;
                }
                return a.localeCompare(b);
            }).forEach(date => {
                const dateArrangements = arrangementsByDate[date];
                
                // 创建日期标题
                const dateDiv = document.createElement('div');
                dateDiv.className = 'date-group';
                dateDiv.style.marginBottom = '16px';
                
                // 获取日期对象用于显示更友好的格式
                const dateObj = parseDateString(date);
                let dateDisplay = date;
                
                if (dateObj) {
                    const month = dateObj.getMonth() + 1;
                    const day = dateObj.getDate();
                    const weekDay = reverseWeekDayMap[dateObj.getDay()];
                    dateDisplay = `${month}月${day}日 (周${weekDay})`;
                }
                
                dateDiv.innerHTML = `
                    <div style="font-weight: bold; color: var(--primary-color); 
                               font-size: 16px; padding: 8px 0; border-bottom: 1px solid #eee;">
                        ${escapeHtml(dateDisplay)}
                    </div>
                `;
                historyDiv.appendChild(dateDiv);
                
                // 按餐点时间排序（午餐在前，晚餐在后）
                dateArrangements.sort((a, b) => a.mealTime === '午餐' ? -1 : 1);
                
                // 添加该日期的所有餐点
                dateArrangements.forEach(arrangement => {
                    const mealDiv = document.createElement('div');
                    mealDiv.className = 'meal-card';
                    mealDiv.innerHTML = `
                        <div class="meal-content">
                            ${escapeHtml(arrangement.mealTime)}
                            ${arrangement.owner === 'others' ? `<span style="color: #28a745; font-weight: bold; margin: 0 4px;">[他人]</span>` : ''}
                            <span class="meal-number">${escapeHtml(arrangement.number)}</span>号: ${escapeHtml(arrangement.content)}
                        </div>
                    `;
                    dateDiv.appendChild(mealDiv);
                });
            });
        }

        // 显示今日餐点
        function displayTodayMeals() {
            try {
                let arrangements;
                if (window.CommonUtils && window.CommonUtils.getLocalStorageItem) {
                    arrangements = window.CommonUtils.getLocalStorageItem(MEAL_STORAGE_KEY, []);
                } else {
                    arrangements = JSON.parse(localStorage.getItem(MEAL_STORAGE_KEY) || '[]');
                }
                const todayInfo = getTodayFormats();
                
                // 获取当前时间
                const now = new Date();
                const currentTime = now.getHours() * 60 + now.getMinutes(); // 转换为分钟计数
                
                // 定义时间限制
                const lunchEndTime = 13 * 60; // 13:00
                const dinnerEndTime = 19 * 60 + 20; // 19:20
                
                // 过滤今日餐点，并根据时间判断是否显示
                const todayMeals = arrangements.filter(arrangement => {
                    // 尝试解析日期
                    const dateObj = parseDateString(arrangement.date);
                    if (!dateObj) return false; // 如果无法解析，则不显示
                    
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    
                    // 如果不是今天的安排，则不显示
                    if (dateObj.getTime() !== today.getTime()) {
                        return false;
                    }
                    
                    // 根据时间判断是否显示
                    if (arrangement.mealTime === '午餐') {
                        return currentTime <= lunchEndTime;
                    } else if (arrangement.mealTime === '晚餐') {
                        return currentTime <= dinnerEndTime;
                    }
                    
                    return true;
                });
                
                renderTodayMeals(todayMeals, todayInfo);
            } catch (e) {
                console.error('显示今日餐点时出错:', e);
                document.getElementById('todayMeals').innerHTML = 
                    `<div style="color: red; text-align: center; padding: 20px;">
                        显示今日餐点时出错: ${escapeHtml(e.message)}
                    </div>`;
            }
        }

        // 渲染今日餐点
        function renderTodayMeals(todayMeals, todayInfo) {
            const todayDiv = document.getElementById('todayMeals');
            const timeStr = todayInfo.timeStr;
            const todayStr = `${todayInfo.fullDate} ${todayInfo.weekDay}`;
            
            if (todayMeals.length > 0) {
                todayDiv.innerHTML = `
                    <div class="today-date">
                        ${todayStr}
                        <span style="font-size: 14px; color: #666; margin-left: 8px;">${timeStr}</span>
                    </div>
                    ${todayMeals.map(meal => `
                        <div class="meal-item" style="margin: 12px 0;">
                            <div style="color: #666; font-size: 14px;">
                                ${escapeHtml(meal.mealTime)}
                                ${meal.mealTime === '午餐' ? 
                                    '<span style="color: #999; font-size: 12px; margin-left: 8px;">13:00后隐藏</span>' : 
                                    '<span style="color: #999; font-size: 12px; margin-left: 8px;">19:20后隐藏</span>'}
                            </div>
                            <div style="font-size: 18px; margin: 4px 0;">
                                <span class="meal-number" style="font-size: 20px;">${escapeHtml(meal.number)}</span>号
                                ${meal.owner === 'others' ? `<span style="color: #28a745; font-weight: normal; font-size: 14px; vertical-align: middle; margin-left: 6px;">(他人)</span>` : ''}
                            </div>
                            <div style="color: #333;">${escapeHtml(meal.content)}</div>
                        </div>
                    `).join('')}
                `;
            } else {
                todayDiv.innerHTML = `
                    <div class="today-date">
                        ${todayStr}
                        <span style="font-size: 14px; color: #666; margin-left: 8px;">${timeStr}</span>
                    </div>
                    <div style="color: #666; margin-top: 8px;">今日暂无订餐安排</div>
                `;
            }
        }

        // 添加智能定时刷新功能
        let refreshTimer = null;
        let lastRefreshDate = new Date().getDate();

        function startAutoRefresh() {
            // 清除已存在的定时器
            if (refreshTimer) {
                clearInterval(refreshTimer);
            }

            // 使用Visibility API暂停后台刷新，节省资源
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    // 页面隐藏时停止刷新
                    if (refreshTimer) {
                        clearInterval(refreshTimer);
                        refreshTimer = null;
                    }
                } else {
                    // 页面可见时立即刷新并重启定时器
                    displayTodayMeals();
                    startRefreshTimer();
                }
            });

            // 启动定时器
            startRefreshTimer();
        }

        let lastRefreshHour = new Date().getHours();

        function startRefreshTimer() {
            refreshTimer = setInterval(() => {
                const now = new Date();
                const currentDate = now.getDate();
                const currentHour = now.getHours();

                // 跨日、或经过午餐/晚餐分界时间点（11:00、17:00）时刷新
                const crossedMealBoundary = (lastRefreshHour < 11 && currentHour >= 11) ||
                    (lastRefreshHour < 17 && currentHour >= 17);

                if (currentDate !== lastRefreshDate || crossedMealBoundary) {
                    lastRefreshDate = currentDate;
                    lastRefreshHour = currentHour;
                    displayTodayMeals();
                }

                lastRefreshHour = currentHour;
            }, 60000);
        }

        // 清除所有数据
        function clearData() {
            window.DialogService.confirmAction('确定要清除所有安排吗？此操作不可恢复！').then(function(confirmed) {
                if (!confirmed) return;
                try {
                    if (window.CommonUtils && window.CommonUtils.removeLocalStorageItem) {
                        window.CommonUtils.removeLocalStorageItem(MEAL_STORAGE_KEY);
                    } else {
                        localStorage.removeItem(MEAL_STORAGE_KEY);
                    }
                    displayMeals();
                    displayTodayMeals();
                    showToast('已清除所有安排', 'success');
                } catch (e) {
                    showToast('清除数据时出错: ' + e.message, 'error');
                    console.error('清除数据时出错:', e);
                }
            });
        }

        // 使用公共工具库的通知函数
        function showToast(message, type = 'info') {
            window.DialogService.showToast(message, type, { duration: 3000 });
        }

        // 初始化事件监听器
        document.addEventListener('DOMContentLoaded', function() {
            // 保存按钮
            const saveBtn = document.getElementById('save-meal-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', processMealData);
            }

            // 清除按钮
            const clearBtn = document.getElementById('clear-meal-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', clearData);
            }

            // 页面加载初始化
            displayMeals();
            displayTodayMeals();
            startAutoRefresh(); // 启动自动刷新
        });
