        /**
         * 今日点餐查看器
         * 用于管理和查看每日三餐安排
         * @module MealViewer
         */

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
        function detectWeekFromHeader(text, referenceDate = new Date()) {
            const lines = text.split('\n').slice(0, 5); // 只看前5行
            const now = new Date(referenceDate);
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
                    const startCandidates = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
                        .map(year => new Date(year, startMonth - 1, startDay))
                        .filter(date => date.getMonth() === startMonth - 1 && date.getDate() === startDay)
                        .sort((a, b) => Math.abs(a - today) - Math.abs(b - today));
                    const rangeStart = startCandidates[0];
                    if (!rangeStart) continue;

                    let rangeEnd = endMonth ?
                        new Date(rangeStart.getFullYear(), endMonth - 1, endDay) : new Date(rangeStart);
                    if (rangeEnd.getMonth() !== endMonth - 1 || rangeEnd.getDate() !== endDay) {
                        continue;
                    }
                    if (rangeEnd < rangeStart) {
                        rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);
                    }

                    // 如果范围的起始日期在今天之后（超过1天），判定为下周
                    const diffDays = Math.floor((rangeStart - today) / (1000 * 60 * 60 * 24));
                    const isNextWeek = diffDays > 2;

                    return { isNextWeek, startDate: rangeStart, endDate: rangeEnd };
                }
            }

            return { isNextWeek: false, startDate: null, endDate: null };
        }

        // 格式化日期对象并保留年份，避免跨年后重新解析产生歧义
        function formatDate(dateObj) {
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            const day = dateObj.getDate();
            const weekDayChar = reverseWeekDayMap[dateObj.getDay()];
            return `${year}年${month}月${day}日-周${weekDayChar}`;
        }

        // 获取今天的日期格式化字符串
        function getTodayFormats() {
            const now = new Date();
            const weekDay = reverseWeekDayMap[now.getDay()];
            return {
                date: now,
                fullDate: `${now.getMonth() + 1}月${now.getDate()}日`,
                weekDay: `周${weekDay}`,
                timeStr: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
            };
        }

        // 标准化日期格式
        function standardizeDate(dateStr, rangeInfo = null, referenceDate = new Date()) {
            const now = new Date(referenceDate);
            const currentWeekDay = now.getDay(); // 0-6，周日是0

            // 明确月日优先使用头部范围锚定，不能再按“下周”重复平移七天
            const dateMatch = dateStr.match(/(?:(\d{4})年)?(\d+)月(\d+)日/);
            if (dateMatch) {
                const explicitYear = dateMatch[1] ? parseInt(dateMatch[1], 10) : null;
                const month = parseInt(dateMatch[2], 10);
                const day = parseInt(dateMatch[3], 10);
                const candidates = [];

                if (explicitYear) {
                    candidates.push(new Date(explicitYear, month - 1, day));
                } else if (rangeInfo && rangeInfo.startDate && rangeInfo.endDate) {
                    const firstYear = rangeInfo.startDate.getFullYear();
                    const lastYear = rangeInfo.endDate.getFullYear();
                    for (let year = firstYear; year <= lastYear; year++) {
                        candidates.push(new Date(year, month - 1, day));
                    }
                } else {
                    candidates.push(
                        new Date(now.getFullYear() - 1, month - 1, day),
                        new Date(now.getFullYear(), month - 1, day),
                        new Date(now.getFullYear() + 1, month - 1, day)
                    );
                }

                const validCandidates = candidates.filter(date =>
                    date.getMonth() === month - 1 && date.getDate() === day
                );
                let targetDate;
                if (rangeInfo && rangeInfo.startDate && rangeInfo.endDate) {
                    targetDate = validCandidates.find(date =>
                        date >= rangeInfo.startDate && date <= rangeInfo.endDate
                    );
                } else {
                    targetDate = validCandidates.sort((a, b) => Math.abs(a - now) - Math.abs(b - now))[0];
                }
                return targetDate ? formatDate(targetDate) : dateStr;
            }

            // 周几输入在头部日期范围中查找对应日期，范围缺失时才按当前周计算
            const weekDayMatch = dateStr.match(/[周星期]([一二三四五六日])/);
            if (weekDayMatch) {
                const dayNumber = weekDayMap[weekDayMatch[1]];
                let targetDate = null;

                if (rangeInfo && rangeInfo.startDate && rangeInfo.endDate) {
                    const candidate = new Date(rangeInfo.startDate);
                    while (candidate <= rangeInfo.endDate) {
                        if (candidate.getDay() === dayNumber) {
                            targetDate = new Date(candidate);
                            break;
                        }
                        candidate.setDate(candidate.getDate() + 1);
                    }
                }

                if (!targetDate) {
                    let diff = dayNumber - currentWeekDay;
                    if (currentWeekDay === 0 && dayNumber > 0) diff = dayNumber;
                    if (currentWeekDay > 0 && dayNumber === 0) diff = 7 - currentWeekDay;
                    targetDate = new Date(now);
                    targetDate.setDate(now.getDate() + diff);
                }

                return formatDate(targetDate);
            }
            
            // 如果是其他格式，直接返回原始字符串
            return dateStr;
        }

        // 统一的日期解析函数
        function parseDateString(dateStr) {
            if (typeof dateStr !== 'string' || !dateStr) return null;
            
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const currentDay = now.getDay(); // 使用标准的0-6表示
            
            // 尝试匹配"X月X日"格式
            const dateMatch = dateStr.match(/(?:(\d{4})年)?(\d+)月(\d+)日/);
            if (dateMatch) {
                const explicitYear = dateMatch[1] ? parseInt(dateMatch[1], 10) : null;
                const month = parseInt(dateMatch[2], 10);
                const day = parseInt(dateMatch[3], 10);
                const candidates = explicitYear ?
                    [new Date(explicitYear, month - 1, day)] :
                    [
                        new Date(today.getFullYear() - 1, month - 1, day),
                        new Date(today.getFullYear(), month - 1, day),
                        new Date(today.getFullYear() + 1, month - 1, day)
                    ];
                return candidates
                    .filter(date => date.getMonth() === month - 1 && date.getDate() === day &&
                        (!explicitYear || date.getFullYear() === explicitYear))
                    .sort((a, b) => Math.abs(a - today) - Math.abs(b - today))[0] || null;
            }
            
            // 尝试匹配"周X"或"星期X"格式
            const weekDayMatch = dateStr.match(/[周星期]([一二三四五六日])/);
            if (weekDayMatch) {
                const weekDay = weekDayMatch[1];
                const targetDay = weekDayMap[weekDay];
                
                // 计算当周对应星期几的日期
                let diff = targetDay - currentDay;
                
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + diff);
                
                return targetDate;
            }

            return null;
        }

        /** 优先走 StorageService，测试与旧页面可回退 CommonUtils。 */
        function readStoredArrangements() {
            if (window.StorageService && typeof window.StorageService.getJson === 'function') {
                return window.StorageService.getJson(MEAL_STORAGE_KEY, []);
            }
            return window.CommonUtils.getLocalStorageItem(MEAL_STORAGE_KEY, []);
        }

        function writeStoredArrangements(arrangements) {
            if (window.StorageService && typeof window.StorageService.setJson === 'function') {
                return window.StorageService.setJson(MEAL_STORAGE_KEY, arrangements).ok;
            }
            return window.CommonUtils.setLocalStorageItem(MEAL_STORAGE_KEY, arrangements);
        }

        function removeStoredArrangements() {
            if (window.StorageService && typeof window.StorageService.remove === 'function') {
                return window.StorageService.remove(MEAL_STORAGE_KEY).ok;
            }
            return window.CommonUtils.removeLocalStorageItem(MEAL_STORAGE_KEY);
        }

        // 存储数据损坏时只忽略无效记录，避免影响整个页面启动。
        function readArrangements() {
            const stored = readStoredArrangements();
            if (!Array.isArray(stored)) return [];

            return stored.filter(arrangement =>
                arrangement &&
                typeof arrangement === 'object' &&
                typeof arrangement.date === 'string' &&
                parseDateString(arrangement.date) &&
                ['午餐', '晚餐'].includes(arrangement.mealTime) &&
                (typeof arrangement.number === 'string' || typeof arrangement.number === 'number') &&
                typeof arrangement.content === 'string' &&
                ['mine', 'others'].includes(arrangement.owner)
            );
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

                const quickNumbers = quickNumbersInput.trim()
                    ? quickNumbersInput.trim().split(/[\s,，]+/)
                    : [];
                if (quickNumbers.some(number => !/^\d{1,3}$/.test(number))) {
                    showToast('快捷序号请用空格或逗号分隔，每项限 1～3 位数字', 'error');
                    return;
                }
                
                const owner = document.querySelector('input[name="mealOwner"]:checked').value;
                // 自动检测是否为下周，不再依赖手动勾选
                const headerInfo = detectWeekFromHeader(input);
                // 更新UI提示
                const weekHintEl = document.getElementById('weekDetectHint');
                if (weekHintEl) {
                    if (headerInfo.startDate) {
                        const label = headerInfo.isNextWeek ? '下周' : '本周';
                        weekHintEl.textContent = `已自动识别为「${label}」的记录`;
                        weekHintEl.style.color = headerInfo.isNextWeek ? '#f59e0b' : '#10b981';
                        weekHintEl.style.display = 'block';
                    } else {
                        weekHintEl.style.display = 'none';
                    }
                }

                const lines = input.split('\n').filter(line => line.trim());
                const meals = [];
                
                // 1. 处理详细输入框
                if (input.trim()) {
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();

                        // 跳过纯数字行（序号行如 "01*"、"02"）
                        if (/^\d{1,3}\*?$/.test(line)) continue;
                        // 跳过头部信息行（日期范围、提交信息、配送楼层等）
                        if (/用餐收集|已提交|最后提交|配送楼层|^\d+\.\d+\s*[-~]/.test(line)) continue;

                        // 同时支持【周X餐次】和【周X/日期】两种标题格式。
                        const headerMatch = line.match(/【(.+?)】/);
                        if (!headerMatch || i + 1 >= lines.length) continue;

                        let dateText = headerMatch[1];
                        let expectedMealTime = null;
                        const combinedHeader = dateText.match(/^(周[一二三四五六日])(午餐|晚餐)$/);
                        if (combinedHeader) {
                            dateText = combinedHeader[1];
                            expectedMealTime = combinedHeader[2];
                        }

                        const nextLine = lines[i + 1].trim();
                        const mealMatch = nextLine.match(/^(午餐|晚餐)(\d+)\s*[:：\s]\s*(.+)$/);
                        if (!mealMatch) continue;
                        i++;

                        const mealTime = mealMatch[1];
                        if (expectedMealTime && expectedMealTime !== mealTime) {
                            console.warn('标题和餐点内容的餐次不一致:', line, nextLine);
                            continue;
                        }
                        if (owner === 'others' && mealTime === '午餐') continue;

                        const standardizedDate = standardizeDate(dateText, headerInfo);
                        if (!parseDateString(standardizedDate)) {
                            console.warn('标准化后的日期格式不正确:', standardizedDate);
                            continue;
                        }

                        const content = mealMatch[3].trim();
                        if (!content) continue;
                        meals.push({
                            date: standardizedDate,
                            mealTime,
                            number: mealMatch[2],
                            content,
                            owner
                        });
                    }
                }

                // 2. 处理快捷录入序号
                if (quickNumbers.length) {
                    const startDate = new Date();
                    startDate.setHours(0, 0, 0, 0);

                    // 快捷录入没有头部日期范围，周五起顺延到下周一，其他日期从明天开始。
                    const dayOfWeek = startDate.getDay();
                    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
                        const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
                        startDate.setDate(startDate.getDate() + daysUntilNextMonday);
                    } else {
                        startDate.setDate(startDate.getDate() + 1);
                    }

                    for (let i = 0; i < quickNumbers.length; i++) {
                        const targetDate = new Date(startDate);
                        targetDate.setDate(startDate.getDate() + i);
                        meals.push({
                            date: formatDate(targetDate),
                            mealTime: '晚餐',
                            number: quickNumbers[i],
                            content: '快捷录入',
                            owner: 'others'
                        });
                    }
                }
                
                if (meals.length === 0) {
                    showToast('未能识别任何有效的订餐安排，请检查格式', 'error');
                    return;
                }

                // 同一日期、餐次和归属只保留一条，并在去重后统计真正的新增和更新。
                const uniqueArrangements = new Map();
                removeExpiredArrangements(readArrangements()).forEach(arrangement => {
                    const dateObj = parseDateString(arrangement.date);
                    if (!dateObj || !['午餐', '晚餐'].includes(arrangement.mealTime)) return;
                    const dateKey = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}`;
                    const ownerKey = arrangement.owner === 'others' ? 'others' : 'mine';
                    uniqueArrangements.set(`${dateKey}|${arrangement.mealTime}|${ownerKey}`, arrangement);
                });

                let addedCount = 0;
                let updatedCount = 0;
                const importedSlots = new Map();
                removeExpiredArrangements(meals).forEach(arrangement => {
                    const dateObj = parseDateString(arrangement.date);
                    if (!dateObj || !['午餐', '晚餐'].includes(arrangement.mealTime)) return;
                    const dateKey = `${dateObj.getFullYear()}-${dateObj.getMonth() + 1}-${dateObj.getDate()}`;
                    const ownerKey = arrangement.owner === 'others' ? 'others' : 'mine';
                    const slotKey = `${dateKey}|${arrangement.mealTime}|${ownerKey}`;
                    importedSlots.set(slotKey, arrangement);
                });
                importedSlots.forEach((arrangement, slotKey) => {
                    const current = uniqueArrangements.get(slotKey);
                    if (!current) {
                        addedCount++;
                        uniqueArrangements.set(slotKey, arrangement);
                        return;
                    }
                    if (String(current.number) !== String(arrangement.number) ||
                        current.content !== arrangement.content) {
                        updatedCount++;
                        uniqueArrangements.set(slotKey, arrangement);
                    }
                });

                if (addedCount === 0 && updatedCount === 0) {
                    showToast('没有可新增或更新的安排，请检查日期或重复内容', 'error');
                    return;
                }

                const finalArrangements = [...uniqueArrangements.values()];

                if (!writeStoredArrangements(finalArrangements)) {
                    showToast('保存失败，浏览器存储空间不足或不可用', 'error');
                    return;
                }

                document.getElementById('mealInput').value = '';
                document.getElementById('quickMealNumbers').value = '';
                const weekHintReset = document.getElementById('weekDetectHint');
                if (weekHintReset) weekHintReset.style.display = 'none';

                displayMeals();
                displayTodayMeals();

                const summary = [
                    addedCount > 0 ? `新增 ${addedCount} 条` : '',
                    updatedCount > 0 ? `更新 ${updatedCount} 条` : ''
                ].filter(Boolean).join('，');
                showToast(`成功${summary}安排`, 'success');
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
                const dateObj = parseDateString(arrangement.date);
                if (!dateObj || dateObj < today) return false;

                if (dateObj.getTime() === today.getTime()) {
                    if (arrangement.mealTime === '午餐' && currentTime >= lunchEndTime) return false;
                    if (arrangement.mealTime === '晚餐' && currentTime >= dinnerEndTime) return false;
                }

                return true;
            });
        }

        // 显示所有订餐安排，并隐藏过期安排
        function displayMeals() {
            try {
                const arrangements = readArrangements();
                const filteredArrangements = removeExpiredArrangements(arrangements);
                if (filteredArrangements.length !== arrangements.length) {
                    if (!writeStoredArrangements(filteredArrangements)) {
                        showToast('清理过期安排时保存失败，刷新后可能仍会显示旧数据', 'warning');
                    }
                }

                // 过滤掉今天的安排，因为它们已经在"今日餐点"部分显示了
                const todayInfo = getTodayFormats();
                const today = new Date(
                    todayInfo.date.getFullYear(),
                    todayInfo.date.getMonth(),
                    todayInfo.date.getDate()
                );
                const upcomingArrangements = filteredArrangements.filter(arrangement => {
                    const dateObj = parseDateString(arrangement.date);
                    return dateObj && dateObj.getTime() !== today.getTime();
                });

                // 按日期和时间排序；无效日期已在 read 阶段剔除，这里再兜底。
                upcomingArrangements.sort((a, b) => {
                    const dateA = parseDateString(a.date);
                    const dateB = parseDateString(b.date);
                    if (!dateA || !dateB) return 0;
                    if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
                    if (a.mealTime === b.mealTime) return 0;
                    return a.mealTime === '午餐' ? -1 : 1;
                });

                renderArrangements(upcomingArrangements);
            } catch (e) {
                console.error('显示安排时出错:', e);
                const historyDiv = document.getElementById('mealHistory');
                historyDiv.replaceChildren();
                const errorMessage = document.createElement('div');
                errorMessage.style.color = 'red';
                errorMessage.style.textAlign = 'center';
                errorMessage.style.padding = '20px';
                errorMessage.textContent = `显示安排时出错: ${e.message}`;
                historyDiv.appendChild(errorMessage);
            }
        }

        // 渲染订餐安排
        function renderArrangements(arrangements) {
            const historyDiv = document.getElementById('mealHistory');
            historyDiv.replaceChildren();

            if (arrangements.length === 0) {
                const empty = document.createElement('div');
                empty.style.color = '#666';
                empty.style.textAlign = 'center';
                empty.style.padding = '20px';
                empty.textContent = '暂无安排';
                historyDiv.appendChild(empty);
                return;
            }

            // 按日期分组
            const arrangementsByDate = new Map();
            arrangements.forEach(arrangement => {
                if (!arrangementsByDate.has(arrangement.date)) {
                    arrangementsByDate.set(arrangement.date, []);
                }
                arrangementsByDate.get(arrangement.date).push(arrangement);
            });

            arrangementsByDate.forEach((dateArrangements, date) => {
                // 创建日期标题
                const dateDiv = document.createElement('div');
                dateDiv.style.marginBottom = '16px';

                const dateObj = parseDateString(date);
                const dateTitle = document.createElement('div');
                dateTitle.style.fontWeight = 'bold';
                dateTitle.style.color = 'var(--primary-color)';
                dateTitle.style.fontSize = '16px';
                dateTitle.style.padding = '8px 0';
                dateTitle.style.borderBottom = '1px solid #eee';
                if (dateObj) {
                    const month = dateObj.getMonth() + 1;
                    const day = dateObj.getDate();
                    const weekDay = reverseWeekDayMap[dateObj.getDay()];
                    dateTitle.textContent = `${month}月${day}日 (周${weekDay})`;
                } else {
                    // 无法解析的日期键原样展示，避免恶意或损坏数据导致渲染中断。
                    dateTitle.textContent = date;
                }
                dateDiv.appendChild(dateTitle);
                historyDiv.appendChild(dateDiv);

                // 添加该日期的所有餐点
                dateArrangements.forEach(arrangement => {
                    const mealDiv = document.createElement('div');
                    mealDiv.className = 'meal-card';
                    const mealContent = document.createElement('div');
                    mealContent.className = 'meal-content';
                    mealContent.appendChild(document.createTextNode(`${arrangement.mealTime} `));
                    if (arrangement.owner === 'others') {
                        const owner = document.createElement('span');
                        owner.style.color = '#28a745';
                        owner.style.fontWeight = 'bold';
                        owner.style.margin = '0 4px';
                        owner.textContent = '[他人]';
                        mealContent.appendChild(owner);
                    }
                    const number = document.createElement('span');
                    number.className = 'meal-number';
                    number.textContent = arrangement.number;
                    mealContent.appendChild(number);
                    mealContent.appendChild(document.createTextNode(`号: ${arrangement.content}`));
                    mealDiv.appendChild(mealContent);
                    dateDiv.appendChild(mealDiv);
                });
            });
        }

        // 显示今日餐点
        function displayTodayMeals() {
            try {
                const todayInfo = getTodayFormats();
                const today = new Date(
                    todayInfo.date.getFullYear(),
                    todayInfo.date.getMonth(),
                    todayInfo.date.getDate()
                );
                const todayMeals = removeExpiredArrangements(readArrangements())
                    .filter(arrangement => {
                        const dateObj = parseDateString(arrangement.date);
                        return dateObj && dateObj.getTime() === today.getTime();
                    })
                    .sort((a, b) => {
                        if (a.mealTime === b.mealTime) return 0;
                        return a.mealTime === '午餐' ? -1 : 1;
                    });

                renderTodayMeals(todayMeals, todayInfo);
            } catch (e) {
                console.error('显示今日餐点时出错:', e);
                const todayDiv = document.getElementById('todayMeals');
                todayDiv.replaceChildren();
                const errorMessage = document.createElement('div');
                errorMessage.style.color = 'red';
                errorMessage.style.textAlign = 'center';
                errorMessage.style.padding = '20px';
                errorMessage.textContent = `显示今日餐点时出错: ${e.message}`;
                todayDiv.appendChild(errorMessage);
            }
        }

        // 渲染今日餐点
        function renderTodayMeals(todayMeals, todayInfo) {
            const todayDiv = document.getElementById('todayMeals');
            const timeStr = todayInfo.timeStr;
            const todayStr = `${todayInfo.fullDate} ${todayInfo.weekDay}`;
            todayDiv.replaceChildren();

            const date = document.createElement('div');
            date.className = 'today-date';
            date.appendChild(document.createTextNode(todayStr));
            const time = document.createElement('span');
            time.style.fontSize = '14px';
            time.style.color = '#666';
            time.style.marginLeft = '8px';
            time.textContent = timeStr;
            date.appendChild(time);
            todayDiv.appendChild(date);

            if (todayMeals.length === 0) {
                const empty = document.createElement('div');
                empty.style.color = '#666';
                empty.style.marginTop = '8px';
                empty.textContent = '今日暂无订餐安排';
                todayDiv.appendChild(empty);
                return;
            }

            todayMeals.forEach(meal => {
                const mealItem = document.createElement('div');
                mealItem.className = 'meal-item';
                mealItem.style.margin = '12px 0';

                const mealTime = document.createElement('div');
                mealTime.style.color = '#666';
                mealTime.style.fontSize = '14px';
                mealTime.appendChild(document.createTextNode(meal.mealTime));
                const cutoff = document.createElement('span');
                cutoff.style.color = '#999';
                cutoff.style.fontSize = '12px';
                cutoff.style.marginLeft = '8px';
                cutoff.textContent = meal.mealTime === '午餐' ? '13:00后隐藏' : '19:20后隐藏';
                mealTime.appendChild(cutoff);

                const numberRow = document.createElement('div');
                numberRow.style.fontSize = '18px';
                numberRow.style.margin = '4px 0';
                const number = document.createElement('span');
                number.className = 'meal-number';
                number.style.fontSize = '20px';
                number.textContent = meal.number;
                numberRow.appendChild(number);
                numberRow.appendChild(document.createTextNode('号'));
                if (meal.owner === 'others') {
                    const owner = document.createElement('span');
                    owner.style.color = '#28a745';
                    owner.style.fontWeight = 'normal';
                    owner.style.fontSize = '14px';
                    owner.style.verticalAlign = 'middle';
                    owner.style.marginLeft = '6px';
                    owner.textContent = '(他人)';
                    numberRow.appendChild(owner);
                }

                const mealContent = document.createElement('div');
                mealContent.style.color = '#333';
                mealContent.textContent = meal.content;
                mealItem.appendChild(mealTime);
                mealItem.appendChild(numberRow);
                mealItem.appendChild(mealContent);
                todayDiv.appendChild(mealItem);
            });
        }

        let refreshTimer = null;

        function startRefreshTimer() {
            if (refreshTimer) clearTimeout(refreshTimer);
            const now = new Date();
            const delay = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
            refreshTimer = setTimeout(() => {
                displayMeals();
                displayTodayMeals();
                startRefreshTimer();
            }, delay);
        }

        // 清除所有数据
        function clearData() {
            window.DialogService.confirmAction('确定要清除所有安排吗？此操作不可恢复！').then(function(confirmed) {
                if (!confirmed) return;
                if (!removeStoredArrangements()) {
                    showToast('清除失败，浏览器存储不可用', 'error');
                    return;
                }
                displayMeals();
                displayTodayMeals();
                showToast('已清除所有安排', 'success');
            });
        }

        // 使用公共工具库的通知函数
        function showToast(message, type = 'info') {
            window.DialogService.showToast(message, type, { duration: 3000 });
        }

        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('save-meal-btn').addEventListener('click', processMealData);
            document.getElementById('clear-meal-btn').addEventListener('click', clearData);
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    if (refreshTimer) clearTimeout(refreshTimer);
                    refreshTimer = null;
                    return;
                }
                displayMeals();
                displayTodayMeals();
                startRefreshTimer();
            });

            displayMeals();
            displayTodayMeals();
            startRefreshTimer();
        });
