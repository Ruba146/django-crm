document.addEventListener('DOMContentLoaded', function () {
    const links = document.querySelectorAll('.sidebar .nav-link, .navbar .nav-link');

    links.forEach(function (link) {
        link.addEventListener('click', function () {
            links.forEach(function (item) {
                item.classList.remove('active');
            });
            link.classList.add('active');
        });
    });

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
