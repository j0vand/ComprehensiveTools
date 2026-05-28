/**
 * 库存 UI - 分页控件
 */
(function() {
    'use strict';

    UIManager.prototype.renderPagination = function() {
        if (!this.elements.paginationControls) return;

        const { currentPage, totalPages } = this.pagination;

        if (totalPages <= 1) {
            this.elements.paginationControls.style.display = 'none';
            return;
        }

        this.elements.paginationControls.style.display = 'flex';
        this.elements.paginationControls.innerHTML = '';

        const prevButton = document.createElement('button');
        prevButton.className = `page-button ${currentPage === 1 ? 'disabled' : ''}`;
        prevButton.textContent = '←';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                this.pagination.currentPage--;
                this.renderContent();
            }
        });
        this.elements.paginationControls.appendChild(prevButton);

        const maxPageButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
        const endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

        if (endPage - startPage + 1 < maxPageButtons) {
            startPage = Math.max(1, endPage - maxPageButtons + 1);
        }

        if (startPage > 1) {
            const firstPageButton = document.createElement('button');
            firstPageButton.className = 'page-button';
            firstPageButton.textContent = '1';
            firstPageButton.addEventListener('click', () => {
                this.pagination.currentPage = 1;
                this.renderContent();
            });
            this.elements.paginationControls.appendChild(firstPageButton);

            if (startPage > 2) {
                const ellipsisButton = document.createElement('button');
                ellipsisButton.className = 'page-button disabled';
                ellipsisButton.textContent = '...';
                ellipsisButton.disabled = true;
                this.elements.paginationControls.appendChild(ellipsisButton);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `page-button ${i === currentPage ? 'active' : ''}`;
            pageButton.textContent = i.toString();

            if (i !== currentPage) {
                pageButton.addEventListener('click', () => {
                    this.pagination.currentPage = i;
                    this.renderContent();
                });
            }

            this.elements.paginationControls.appendChild(pageButton);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsisButton = document.createElement('button');
                ellipsisButton.className = 'page-button disabled';
                ellipsisButton.textContent = '...';
                ellipsisButton.disabled = true;
                this.elements.paginationControls.appendChild(ellipsisButton);
            }

            const lastPageButton = document.createElement('button');
            lastPageButton.className = 'page-button';
            lastPageButton.textContent = totalPages.toString();
            lastPageButton.addEventListener('click', () => {
                this.pagination.currentPage = totalPages;
                this.renderContent();
            });
            this.elements.paginationControls.appendChild(lastPageButton);
        }

        const nextButton = document.createElement('button');
        nextButton.className = `page-button ${currentPage === totalPages ? 'disabled' : ''}`;
        nextButton.textContent = '→';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                this.pagination.currentPage++;
                this.renderContent();
            }
        });
        this.elements.paginationControls.appendChild(nextButton);
    };
})();
