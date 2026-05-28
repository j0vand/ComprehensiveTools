/**
 * 库存 UI - 摘要与徽章渲染
 */
(function() {
    'use strict';

    UIManager.prototype.renderSummary = function() {
        const stats = InventoryData.getInventoryStats();
        const overview = InventoryData.getQuickOverview();
        const reminders = InventoryData.getReminders();

        if (this.elements.totalItemsCount) {
            this.elements.totalItemsCount.textContent = overview.totalItems;
        }

        if (this.elements.totalBatchesCount) {
            this.elements.totalBatchesCount.textContent = stats.totalBatches;
        }

        if (this.elements.totalValue) {
            this.elements.totalValue.textContent = Utils.formatPrice(stats.totalValue);
        }

        if (this.elements.needToBuyCount) {
            this.elements.needToBuyCount.textContent = overview.needToBuyCount;
        }

        if (this.elements.expiringSoonCount) {
            this.elements.expiringSoonCount.textContent = overview.expiringSoonCount;
        }

        if (this.elements.recentItemsCount) {
            this.elements.recentItemsCount.textContent = overview.recentItemsCount;
        }

        const shoppingList = InventoryData.getShoppingList();
        const unpurchasedCount = shoppingList.filter(item => !item.purchased).length;
        const totalReminders = reminders.expiringSoon.length + reminders.needToBuy.length;

        if (this.elements.shoppingListBadge) {
            if (unpurchasedCount > 0) {
                this.elements.shoppingListBadge.textContent = unpurchasedCount;
                this.elements.shoppingListBadge.style.display = 'inline-block';
            } else {
                this.elements.shoppingListBadge.style.display = 'none';
            }
        }

        if (this.elements.remindersBadge) {
            if (totalReminders > 0) {
                this.elements.remindersBadge.textContent = totalReminders;
                this.elements.remindersBadge.style.display = 'inline-block';
            } else {
                this.elements.remindersBadge.style.display = 'none';
            }
        }
    };
})();
