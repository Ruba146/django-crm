document.addEventListener('DOMContentLoaded', function () {
    if (window.__crmModalHandlersInitialized) {
        return;
    }
    window.__crmModalHandlersInitialized = true;

    const links = document.querySelectorAll('.sidebar .nav-link, .navbar .nav-link');

    const calendarDayModal = document.getElementById('calendarDayModal');
    if (calendarDayModal) {
        const calendarDayTitle = document.getElementById('calendarDayModalTitle');
        const calendarDayPanels = calendarDayModal.querySelectorAll('[data-calendar-day-panel]');

        calendarDayModal.addEventListener('show.bs.modal', function (event) {
            const selectedDate = event.relatedTarget?.getAttribute('data-calendar-date');
            if (!selectedDate) {
                event.preventDefault();
                return;
            }

            calendarDayTitle.textContent = `Tasks for ${selectedDate}`;
            calendarDayPanels.forEach(function (panel) {
                panel.hidden = panel.getAttribute('data-calendar-day-panel') !== selectedDate;
            });
        });
    }

    document.addEventListener('click', function (event) {
        const button = event.target.closest('[data-open-task-modal]');
        if (!button) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const targetSelector = button.getAttribute('data-open-task-modal');
        if (!targetSelector) {
            return;
        }

        const targetModal = document.querySelector(targetSelector);
        const currentModal = button.closest('.modal');
        if (!targetModal || !currentModal || currentModal === targetModal) {
            return;
        }

        if (targetModal.classList.contains('show') || targetModal.getAttribute('aria-hidden') === 'false') {
            return;
        }

        const currentModalInstance = bootstrap.Modal.getInstance(currentModal);

currentModal.addEventListener(
    'hidden.bs.modal',
    function openTargetOnce() {
        currentModal.removeEventListener('hidden.bs.modal', openTargetOnce);

        const targetModalInstance =
            bootstrap.Modal.getOrCreateInstance(targetModal);

        targetModalInstance.show();
    },
    { once: true }
);

if (currentModalInstance) {
    currentModalInstance.hide();
} else {
    const targetModalInstance =
        bootstrap.Modal.getOrCreateInstance(targetModal);

    targetModalInstance.show();
}
    });

    links.forEach(function (link) {
        link.addEventListener('click', function () {
            links.forEach(function (item) {
                item.classList.remove('active');
            });
            link.classList.add('active');
        });
    });

    // Apply AI score color classes based on numeric score (green/orange/red)
    function applyAIScoreColors() {
        document.querySelectorAll('.ai-score-badge').forEach(function (el) {
            const raw = el.dataset.aiScore || el.textContent.replace('%', '').trim();
            const n = parseInt(raw, 10);
            el.classList.remove('text-success', 'text-warning', 'text-danger', 'text-info');
            if (Number.isNaN(n)) {
                return;
            }
            if (n >= 80) {
                el.classList.add('text-success');
            } else if (n >= 50) {
                el.classList.add('text-warning');
            } else {
                el.classList.add('text-danger');
            }
        });
    }

    applyAIScoreColors();

    const dealCards = document.querySelectorAll('[data-kanban-card="true"]');
    const kanbanColumns = document.querySelectorAll('.kanban-column');
    let activeCard = null;

    dealCards.forEach(function (card) {
        card.addEventListener('dragstart', function () {
            activeCard = card;
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', function () {
            card.classList.remove('dragging');
            activeCard = null;
        });
    });

    kanbanColumns.forEach(function (column) {
        column.addEventListener('dragover', function (event) {
            event.preventDefault();
            column.classList.add('drop-target');
        });

        column.addEventListener('dragleave', function () {
            column.classList.remove('drop-target');
        });

        column.addEventListener('drop', function (event) {
            event.preventDefault();
            if (!activeCard) {
                return;
            }
            column.appendChild(activeCard);
            column.classList.remove('drop-target');
        });
    });
});
