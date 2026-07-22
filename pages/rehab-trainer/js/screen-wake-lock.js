/**
 * 屏幕常亮管理器
 * 使用Wake Lock API保持屏幕常亮
 */
class ScreenWakeLock {
    constructor() {
        this.wakeLock = null;
        this.isSupported = 'wakeLock' in navigator;
        this.active = false;
        this.requestPending = false;
        this.retryRequested = false;
        this.desired = false;
    }

    /**
     * 请求屏幕常亮
     */
    async request() {
        // 如果不支持Wake Lock API，或者已经在激活状态，直接返回
        if (!this.isSupported) return false;
        this.desired = true;
        if (this.active) {
            return false;
        }
        if (this.requestPending) {
            this.retryRequested = true;
            return false;
        }

        this.requestPending = true;
        try {
            const lock = await navigator.wakeLock.request('screen');
            if (!this.desired) {
                await lock.release();
                return false;
            }
            this.wakeLock = lock;
            this.active = true;

            // 监听释放事件
            lock.addEventListener('release', () => {
                if (this.wakeLock === lock) {
                    this.wakeLock = null;
                    this.active = false;
                }
            });

            return true;
        } catch (err) {
            console.warn('激活屏幕常亮失败:', err);
            return false;
        } finally {
            this.requestPending = false;
            const shouldRetry = this.retryRequested && this.desired && !this.active;
            this.retryRequested = false;
            // 合并期间的新请求只补发一次；若补发失败，等待下一次真实用户请求。
            if (shouldRetry) this.request();
        }
    }

    /**
     * 释放屏幕常亮
     */
    async release() {
        this.desired = false;
        if (!this.wakeLock || !this.active) {
            return;
        }

        const lock = this.wakeLock;
        this.wakeLock = null;
        this.active = false;
        try {
            await lock.release();
        } catch (err) {
            console.error('释放屏幕常亮失败:', err);
        }
    }

}

// 创建全局实例
const screenWakeLock = new ScreenWakeLock();
