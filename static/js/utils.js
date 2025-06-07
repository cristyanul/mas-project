// Dashboard Utilities

let liveUpdateInterval;
let quickStartActive = false;

function startLiveUpdates() {
    if (liveUpdateInterval) {
        clearInterval(liveUpdateInterval);
    }
    liveUpdateInterval = setInterval(() => {
        if (!quickStartActive) {
            updateDashboardData();
        }
    }, 2000);
}

function stopLiveUpdates() {
    if (liveUpdateInterval) {
        clearInterval(liveUpdateInterval);
        liveUpdateInterval = null;
    }
}

function manualRefresh() {
    updateDashboardData();
    const refreshIcon = document.querySelector('.refresh-button i');
    refreshIcon.style.transform = 'rotate(360deg)';
    setTimeout(() => {
        refreshIcon.style.transform = 'rotate(0deg)';
    }, 300);
}

function updateDashboardData() {
    fetch('/api/dashboard')
        .then(response => response.json())
        .then(data => {
            updateMetrics(data.metrics);
            updateInventory(data.inventory);
            updateDeliveries(data.deliveries);
            updateNotifications(data.notifications);
            updateDeliveryHistory(data.delivery_history);
        })
        .catch(error => {
            console.error('Error updating dashboard:', error);
        });
}

function updateMetrics(metrics) {
    const deliveredElement = document.querySelector('.metrics-delivered');
    const pendingElement = document.querySelector('.metrics-pending');
    const notificationsElement = document.querySelector('.metrics-notifications');
    const todaySummaryElement = document.getElementById('today-summary-count');

    if (deliveredElement) deliveredElement.innerText = metrics.delivered_today;
    if (pendingElement) pendingElement.innerText = metrics.pending_deliveries;
    if (notificationsElement) notificationsElement.innerText = metrics.notifications;
    if (todaySummaryElement) todaySummaryElement.innerText = metrics.delivered_today;

    const metricCards = document.querySelectorAll('.card .metrics-value');
    metricCards.forEach((element, index) => {
        const cardTitle = element.closest('.card').querySelector('.card-title');
        if (cardTitle && cardTitle.textContent.includes('Completed')) {
            element.innerText = metrics.completed_deliveries;
        }
    });
}

function updateInventory(inventory) {
    const tbody = document.querySelector('#inventory-section tbody');
    if (!tbody) return;

    const editingItems = Array.from(tbody.querySelectorAll('.edit-quantity')).filter(input => input.style.display !== 'none');
    if (editingItems.length > 0) {
        updateOrderFormOptions(inventory);
        return;
    }

    const currentItems = Array.from(tbody.querySelectorAll('tr')).map(row => {
        const itemName = row.querySelector('td:first-child')?.textContent;
        const quantity = row.querySelector('.inventory-count')?.textContent;
        return { item: itemName, quantity: parseInt(quantity) };
    }).filter(item => item.item);

    const inventoryEntries = Object.entries(inventory);
    const hasChanges = currentItems.length !== inventoryEntries.length ||
                        !currentItems.every(current => {
                            const newCount = inventory[current.item];
                            return newCount !== undefined && newCount === current.quantity;
                        });

    if (hasChanges) {
        tbody.innerHTML = '';

        inventoryEntries.forEach(([item, count]) => {
            const row = createInventoryRow(item, count);
            tbody.appendChild(row);
        });
    }

    updateOrderFormOptions(inventory);
}

function createInventoryRow(item, count) {
    const row = document.createElement('tr');

    let statusBadge;
    let statusClass;
    if (count <= 0) {
        statusBadge = '<span class="badge bg-danger">Out of Stock</span>';
        statusClass = 'low-stock';
    } else if (count < 3) {
        statusBadge = '<span class="badge bg-warning text-dark">Low Stock</span>';
        statusClass = 'low-stock';
    } else {
        statusBadge = '<span class="badge bg-success">In Stock</span>';
        statusClass = 'good-stock';
    }

    row.innerHTML = `
        <td>${item}</td>
        <td>
            <div class="d-flex align-items-center">
                <span class="inventory-count ${statusClass} me-2" id="quantity-display-${item}">${count}</span>
                <input type="number" class="form-control form-control-sm edit-quantity"
                        id="quantity-input-${item}" value="${count}" min="0"
                        style="width: 70px; display: none;">
            </div>
        </td>
        <td>${statusBadge}</td>
        <td>
            <div class="btn-group" role="group">
                <button type="button" class="btn btn-sm btn-outline-primary edit-btn"
                        data-item="${item}" onclick="editItem('${item}')">
                    <i class="bi bi-pencil"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-success save-btn"
                        data-item="${item}" onclick="saveItem('${item}')"
                        style="display: none;">
                    <i class="bi bi-check"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary cancel-btn"
                        data-item="${item}" onclick="cancelEdit('${item}')"
                        style="display: none;">
                    <i class="bi bi-x"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger delete-btn"
                        data-item="${item}" onclick="deleteItem('${item}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </td>
    `;

    return row;
}

function updateOrderFormOptions(inventory) {
    const itemSelect = document.getElementById('order-item');
    const quantityInput = document.getElementById('order-quantity');
    if (!itemSelect) return;

    const isSelectFocused = document.activeElement === itemSelect;
    const isQuantityFocused = document.activeElement === quantityInput;

    if (isSelectFocused || isQuantityFocused) {
        return;
    }

    const currentValue = itemSelect.value;
    const currentQuantity = quantityInput ? quantityInput.value : '1';

    const newOptions = ['<option value="">Select an item</option>'];
    Object.entries(inventory).forEach(([item, stock]) => {
        newOptions.push(`<option value="${item}" data-stock="${stock}">${item} (${stock} in stock)</option>`);
    });

    itemSelect.innerHTML = newOptions.join('');

    if (currentValue && inventory.hasOwnProperty(currentValue)) {
        itemSelect.value = currentValue;
        if (quantityInput && currentQuantity !== '1') {
            quantityInput.value = currentQuantity;
        }
        updateQuantityLimit();
    }
}

function updateDeliveries(deliveries) {
    const deliveriesContainer = document.querySelector('#deliveries-section .card-body');
    if (!deliveriesContainer) return;

    const existingDeliveries = deliveriesContainer.querySelectorAll('.delivery-notification');
    const existingIds = Array.from(existingDeliveries).map(el => el.dataset.deliveryId);

    if (deliveries.length === 0) {
        deliveriesContainer.innerHTML = '<p class="text-center text-muted">No active deliveries</p>';
        return;
    }

    const newDeliveryMap = new Map();
    deliveries.forEach((delivery, index) => {
        const deliveryId = `${delivery.item}_${delivery.start_time}`;
        newDeliveryMap.set(deliveryId, { ...delivery, index });
    });

    const newIds = Array.from(newDeliveryMap.keys());
    const needsRebuild = existingIds.length !== newIds.length ||
                        !existingIds.every(id => newDeliveryMap.has(id));

    if (needsRebuild) {
        const listGroup = document.createElement('div');
        listGroup.className = 'list-group';

        deliveries.forEach(delivery => {
            const deliveryElement = createDeliveryElement(delivery);
            listGroup.appendChild(deliveryElement);
        });

        deliveriesContainer.innerHTML = '';
        deliveriesContainer.appendChild(listGroup);
    }
}

function createDeliveryElement(delivery) {
    const div = document.createElement('div');
    div.className = 'list-group-item mb-2 p-3 rounded shadow-sm delivery-notification';

    const deliveryId = `${delivery.item}_${delivery.start_time}`;
    div.dataset.deliveryId = deliveryId;

    div.innerHTML = `
        <div class="d-flex align-items-center mb-2">
            <div class="delivery-icon me-3">
                <i class="bi bi-box-seam fs-3 text-primary"></i>
            </div>
            <div>
                <h6 class="mb-1">${delivery.order_display || delivery.item}</h6>
                <div class="text-muted small">
                    Estimated delivery: <span class="delivery-eta"
                    data-delivery-time="${delivery.estimated_delivery}"
                    data-start-time="${delivery.start_time}"
                    data-delivery-duration="${delivery.delivery_duration}"></span>
                </div>
            </div>
            <span class="ms-auto badge bg-primary status-badge">${delivery.status}</span>
        </div>
        <div class="progress" style="height: 5px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated bg-success delivery-progress"
                role="progressbar"
                data-delivery-time="${delivery.estimated_delivery}"
                data-start-time="${delivery.start_time}"
                data-delivery-duration="${delivery.delivery_duration}"
                style="width: 0%">
            </div>
        </div>
    `;

    return div;
}

function updateNotifications(notifications) {
    const notificationsContainer = document.querySelector('.card-header.bg-warning').nextElementSibling;
    if (!notificationsContainer) return;

    if (notifications.length === 0) {
        notificationsContainer.innerHTML = '<p class="text-center text-muted">No notifications yet</p>';
        return;
    }

    let notificationsHtml = '';
    notifications.slice().reverse().forEach(notification => {
        const date = new Date(notification.time * 1000);
        notificationsHtml += `
            <div class="notification-item">
                <div class="d-flex justify-content-between">
                    <div>${notification.message}</div>
                    <small class="text-muted">${date.toLocaleTimeString()}</small>
                </div>
            </div>
        `;
    });

    notificationsContainer.innerHTML = notificationsHtml;
}

function updateDeliveryHistory(deliveryHistory) {
    const historyContainer = document.getElementById('delivery-history-container');
    if (!historyContainer) return;

    if (deliveryHistory.length === 0) {
        historyContainer.innerHTML = '<p class="text-center text-muted">No delivery history</p>';
        return;
    }

    historyContainer.innerHTML = `
        <div style="max-height: 200px; overflow-y: auto;">
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody id="delivery-history-tbody">
                </tbody>
            </table>
        </div>
    `;

    const tbody = document.getElementById('delivery-history-tbody');
    deliveryHistory.slice().reverse().forEach(log => {
        const row = document.createElement('tr');
        const date = new Date(log.delivery_time * 1000);
        row.innerHTML = `
            <td>${log.order_display || log.item}</td>
            <td><small class="text-muted">${date.toLocaleTimeString()}</small></td>
        `;
        tbody.appendChild(row);
    });
}

// AJAX Alert System
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alert-container') || createAlertContainer();

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.setAttribute('role', 'alert');
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    alertContainer.appendChild(alert);

    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alert-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.width = '300px';
    document.body.appendChild(container);
    return container;
}

// Inventory Management Functions
function editItem(item) {
    const quantityDisplay = document.getElementById(`quantity-display-${item}`);
    const quantityInput = document.getElementById(`quantity-input-${item}`);
    const editBtn = document.querySelector(`[data-item="${item}"].edit-btn`);
    const saveBtn = document.querySelector(`[data-item="${item}"].save-btn`);
    const cancelBtn = document.querySelector(`[data-item="${item}"].cancel-btn`);
    const deleteBtn = document.querySelector(`[data-item="${item}"].delete-btn`);

    quantityDisplay.style.display = 'none';
    quantityInput.style.display = 'inline-block';
    quantityInput.focus();
    quantityInput.select();

    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';
    deleteBtn.style.display = 'none';
}

function saveItem(item) {
    const quantityInput = document.getElementById(`quantity-input-${item}`);
    const newQuantity = parseInt(quantityInput.value);

    if (isNaN(newQuantity) || newQuantity < 0) {
        showAlert('Please enter a valid quantity', 'danger');
        return;
    }

    const formData = new FormData();
    formData.append('item', item);
    formData.append('quantity', newQuantity);

    fetch('/update_inventory', {
        method: 'POST',
        headers: {
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('Inventory updated successfully!', 'success');
            cancelEdit(item);
            updateDashboardData();
        } else {
            showAlert(data.message || 'Failed to update inventory', 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Error updating inventory', 'danger');
    });
}

function cancelEdit(item) {
    const quantityDisplay = document.getElementById(`quantity-display-${item}`);
    const quantityInput = document.getElementById(`quantity-input-${item}`);
    const editBtn = document.querySelector(`[data-item="${item}"].edit-btn`);
    const saveBtn = document.querySelector(`[data-item="${item}"].save-btn`);
    const cancelBtn = document.querySelector(`[data-item="${item}"].cancel-btn`);
    const deleteBtn = document.querySelector(`[data-item="${item}"].delete-btn`);

    quantityDisplay.style.display = 'inline-block';
    quantityInput.style.display = 'none';
    quantityInput.value = quantityDisplay.textContent;

    editBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    deleteBtn.style.display = 'inline-block';
}

function deleteItem(item) {
    if (confirm(`Are you sure you want to remove "${item}" from inventory?`)) {
        const formData = new FormData();
        formData.append('item', item);

        fetch('/remove_inventory', {
            method: 'POST',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showAlert('Inventory item removed successfully!', 'success');
                updateDashboardData();
            } else {
                showAlert(data.message || 'Failed to remove inventory item', 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Error removing inventory item', 'danger');
        });
    }
}

// Delivery Progress Updates
function updateDeliveryProgress() {
    const now = Math.floor(Date.now() / 1000);

    document.querySelectorAll('.delivery-progress').forEach(progressBar => {
        const startTime = parseInt(progressBar.dataset.startTime);
        const deliveryTime = parseInt(progressBar.dataset.deliveryTime);
        const duration = parseInt(progressBar.dataset.deliveryDuration);

        const elapsed = now - startTime;
        const percentage = Math.min(Math.floor((elapsed / duration) * 100), 100);

        const currentWidth = progressBar.style.width;
        const newWidth = `${percentage}%`;
        if (currentWidth !== newWidth) {
            progressBar.style.width = newWidth;
        }

        if (percentage > 90) {
            const parentElement = progressBar.parentElement.parentElement;
            if (!parentElement.classList.contains('pulse-animation')) {
                parentElement.classList.add('pulse-animation');
            }
        }
    });

    document.querySelectorAll('.delivery-eta').forEach(etaElement => {
        const startTime = parseInt(etaElement.dataset.startTime);
        const deliveryTime = parseInt(etaElement.dataset.deliveryTime);
        const duration = parseInt(etaElement.dataset.deliveryDuration);

        const elapsed = now - startTime;
        const remaining = Math.max(0, duration - elapsed);

        let newText;
        if (remaining === 0) {
            newText = "Delivered!";
        } else {
            newText = `${remaining} seconds remaining`;
        }

        if (etaElement.innerHTML !== newText) {
            etaElement.innerHTML = newText;
        }
    });
}

// Order Form Management
function updateQuantityLimit() {
    const itemSelect = document.getElementById('order-item');
    const quantityInput = document.getElementById('order-quantity');
    const quantityHelp = document.getElementById('order-quantity-help');
    const submitBtn = document.getElementById('order-submit-btn');
    const stockAlert = document.getElementById('stock-alert');

    if (itemSelect.value) {
        const selectedOption = itemSelect.options[itemSelect.selectedIndex];
        const stock = parseInt(selectedOption.dataset.stock);

        quantityInput.disabled = false;
        quantityInput.max = stock;
        quantityInput.value = Math.min(1, stock);
        submitBtn.disabled = false;

        if (stock > 0) {
            quantityHelp.textContent = `Maximum available: ${stock}`;
            quantityHelp.className = 'form-text text-muted';
        } else {
            quantityHelp.textContent = 'Out of stock';
            quantityHelp.className = 'form-text text-danger';
            quantityInput.disabled = true;
            submitBtn.disabled = true;
        }

        stockAlert.style.display = 'none';
    } else {
        quantityInput.disabled = true;
        quantityInput.max = 1;
        quantityInput.value = 1;
        submitBtn.disabled = true;
        quantityHelp.textContent = 'Please select an item first';
        quantityHelp.className = 'form-text text-muted';
        stockAlert.style.display = 'none';
    }
}

function validateOrder() {
    const itemSelect = document.getElementById('order-item');
    const quantityInput = document.getElementById('order-quantity');
    const stockAlert = document.getElementById('stock-alert');

    if (!itemSelect.value) {
        alert('Please select an item');
        return false;
    }

    const selectedOption = itemSelect.options[itemSelect.selectedIndex];
    const stock = parseInt(selectedOption.dataset.stock);
    const requestedQuantity = parseInt(quantityInput.value);

    if (requestedQuantity > stock) {
        stockAlert.style.display = 'block';
        return false;
    }

    if (requestedQuantity <= 0) {
        alert('Please enter a valid quantity');
        return false;
    }

    return true;
}

