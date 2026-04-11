/**
 * 屏幕常亮管理器
 * 使用Wake Lock API保持屏幕常亮
 */
class ScreenWakeLock {
    constructor() {
        this.wakeLock = null;
        this.isSupported = 'wakeLock' in navigator;
        this.isActive = false;
    }

    /**
     * 请求屏幕常亮
     */
    async request() {
        // 如果不支持Wake Lock API，或者已经在激活状态，直接返回
        if (!this.isSupported || this.isActive) {
            return false;
        }

        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.isActive = true;

            // 监听释放事件
            this.wakeLock.addEventListener('release', () => {
                console.log('屏幕常亮已释放');
                this.isActive = false;
            });

            console.log('成功激活屏幕常亮');
            return true;
        } catch (err) {
            console.warn('激活屏幕常亮失败:', err);
            return false;
        }
    }

    /**
     * 释放屏幕常亮
     */
    async release() {
        if (!this.wakeLock || !this.isActive) {
            return;
        }

        try {
            await this.wakeLock.release();
            this.wakeLock = null;
            this.isActive = false;
            console.log('已释放屏幕常亮');
        } catch (err) {
            console.error('释放屏幕常亮失败:', err);
        }
    }

    /**
     * 检查是否支持屏幕常亮
     */
    getSupported() {
        return this.isSupported;
    }

    /**
     * 检查屏幕常亮是否已激活
     */
    isActive() {
        return this.isActive;
    }
}

// 创建全局实例
const screenWakeLock = new ScreenWakeLock();