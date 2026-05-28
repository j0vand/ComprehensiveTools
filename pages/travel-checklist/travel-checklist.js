/**
 * 出行清单 - 启动入口
 */
(function() {
    'use strict';

    function init() {
        window.TravelChecklistState.loadData();
        window.TravelChecklistRender.fillTemplateSelect();
        window.TravelChecklistRender.renderList();
        window.TravelChecklistEvents.bindEvents();

        var newItemInput = document.getElementById('new-item-input');
        if (newItemInput) newItemInput.focus();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
