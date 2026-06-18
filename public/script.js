// 1. Initializing Lucide Icons
lucide.createIcons();

// Helper to map severity level to CSS class
function getSeverityPillClass(severity) {
    const sev = (severity || '').toUpperCase();
    if (sev === 'SEVERE_ERROR' || sev === 'CRITICAL') return 'pill-critical';
    if (sev === 'MAJOR_ERROR') return 'pill-major';
    if (sev === 'WARNING' || sev === 'WARN_MINOR') return 'pill-warning';
    return 'pill-info'; // INFO, INFORMATIONAL, or default
}

// Helper to enrich log rows with event data object and ticket status
function enhanceLogEventRow(tr, ev) {
    tr.eventData = ev;
    tr.style.cursor = 'pointer';
    tr.classList.add('log-event-row');
    if (ev.id) {
        tr.setAttribute('data-event-id', ev.id);
    }
}

function getTicketBadgeHtml(ev) {
    if (ev.ticketId) {
        return `<span class="pill pill-success" style="font-size: 0.65rem; background: rgba(0, 230, 115, 0.15); color: #00e673; border-color: rgba(0, 230, 115, 0.3); margin-left: 6px; padding: 1px 4px; display: inline-flex; align-items: center; gap: 2px;" title="Alarma ticketada: ${ev.ticketId}"><i data-lucide="ticket" style="width: 10px; height: 10px;"></i> ${ev.ticketId} (${ev.ticketStatus})</span>`;
    }
    return '';
}

// 2. State Variables
let allEvents = [];
let filteredEvents = [];
let currentPage = 1;
const itemsPerPage = 12;
let refreshInterval = 30; // default 30s
let timeLeft = refreshInterval;
let autoRefreshTimer = null;

// Cache for client-side sorting and filtering
let cachedClassification = {
    alerts: [],
    hardware: [],
    dicom: [],
    maintenance: [],
    stops: {}
};
let cachedHistory = {};

// Caching and optimization flags
let currentHealthConfig = null;
let lastHistoryParams = null;
let lastClassificationParams = null;
let yangTreeLoaded = false;
let dicomStationsLoaded = false;
let adminClassificationsLoaded = false;


// Sort State tracking
const sortStates = {
    mini: { column: 'timestamp', direction: 'desc' },
    full: { column: 'timestamp', direction: 'desc' },
    hardware: { column: 'timestamp', direction: 'desc' },
    dicom: { column: 'timestamp', direction: 'desc' },
    maintenance: { column: 'timestamp', direction: 'desc' },
    stops: { column: 'date', direction: 'desc' },
    history: { column: 'timestamp', direction: 'desc' }
};

// Search Queries tracking
const searchQueries = {
    mini: '',
    hardware: '',
    dicom: '',
    maintenance: '',
    stops: '',
    history: ''
};

// Chart references
let activityChart = null;
let severityChart = null;

let isDateFilterManual = false;

// Helper to retrieve active date filter query parameters
function getCurrentQueryParams() {
    if (!isDateFilterManual) {
        return "";
    }
    const df = document.getElementById('date-from').value;
    const dt = document.getElementById('date-to').value;
    const dashDate = document.getElementById('dash-date-filter').value;
    
    if (dashDate) {
        const params = new URLSearchParams();
        params.append('from', `${dashDate}T00:00:00Z`);
        params.append('to', `${dashDate}T23:59:59Z`);
        return `?${params.toString()}`;
    } else if (df || dt) {
        const params = new URLSearchParams();
        if (df) params.append('from', new Date(df).toISOString());
        if (dt) params.append('to', new Date(dt).toISOString());
        return `?${params.toString()}`;
    }
    return "";
}

// 3. SPA Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Prevent reloading if already active
        if (item.classList.contains('active')) {
            return;
        }
        
        // Remove active class from all nav items and add to clicked
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        
        // Hide all views and show target view
        const targetView = item.getAttribute('data-view');
        document.querySelectorAll('.view-content').forEach(view => {
            view.classList.remove('active');
            if (view.id === targetView) {
                view.classList.add('active');
            }
        });
        
        // Trigger specific view initializations if needed
        const queryParams = getCurrentQueryParams();
        if (targetView === 'yang') {
            fetchYangTree();
        } else if (targetView === 'history') {
            loadHistoryData(queryParams);
        } else if (targetView === 'bitacora') {
            loadMaintenanceRecords();
        } else if (targetView === 'admin-classifications') {
            loadAdminClassifications();
            loadHealthConfig();
        } else if (targetView === 'hardware') {
            loadHardwareAdminParams();
            loadClassificationData(targetView, queryParams);
        } else if (targetView === 'dicom') {
            loadDicomStations();
            loadClassificationData('dicom', queryParams);
        } else if (['alerts', 'maintenance', 'stops'].includes(targetView)) {
            loadClassificationData(targetView, queryParams);
        }
    });
});

// 4. Initialize Chart.js
function initCharts() {
    const rootStyles = getComputedStyle(document.documentElement);
    const colorPrimary = rootStyles.getPropertyValue('--primary').trim();
    const colorSecondary = rootStyles.getPropertyValue('--secondary').trim();
    const colorAccent = rootStyles.getPropertyValue('--accent').trim();
    const colorCritical = rootStyles.getPropertyValue('--critical').trim();
    const colorWarning = rootStyles.getPropertyValue('--warning').trim();
    const colorInfo = rootStyles.getPropertyValue('--info').trim();

    // Activity Chart (Line)
    const ctxActivity = document.getElementById('activityChart').getContext('2d');
    activityChart = new Chart(ctxActivity, {
        type: 'line',
        data: {
            labels: ['Interval -5', 'Interval -4', 'Interval -3', 'Interval -2', 'Interval -1', 'Current'],
            datasets: [{
                label: 'Event Activity',
                data: [0, 0, 0, 0, 0, 0],
                borderColor: colorPrimary,
                backgroundColor: 'rgba(0, 210, 255, 0.1)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: colorPrimary
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
                }
            }
        }
    });

    // Severity Chart (Doughnut)
    const ctxSeverity = document.getElementById('severityChart').getContext('2d');
    severityChart = new Chart(ctxSeverity, {
        type: 'doughnut',
        data: {
            labels: ['Critical', 'Warning', 'Informational'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [colorCritical, colorWarning, colorInfo],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#e2e8f0',
                        font: { family: 'Outfit', size: 11 },
                        padding: 15
                    }
                }
            },
            cutout: '70%'
        }
    });
}

// 5. Update DOM metrics
function updateMetricsUI(metrics) {
    document.getElementById('kpi-total').innerText = metrics.totalEvents;
    document.getElementById('kpi-critical').innerText = metrics.criticalCount;
    document.getElementById('kpi-warning').innerText = metrics.warningCount;
    document.getElementById('kpi-patients').innerText = metrics.patientsToday;

    // Health percentages
    document.getElementById('health-dhi').innerText = `${Math.round(metrics.dhi)}%`;
    document.getElementById('bar-dhi').style.width = `${metrics.dhi}%`;

    document.getElementById('health-thi').innerText = `${Math.round(metrics.thi)}%`;
    document.getElementById('bar-thi').style.width = `${metrics.thi}%`;

    document.getElementById('health-fhi').innerText = `${Math.round(metrics.fhi)}%`;
    document.getElementById('bar-fhi').style.width = `${metrics.fhi}%`;

    document.getElementById('health-roi').innerText = `$${metrics.roi.toFixed(2)}`;

    // Update Activity Chart (Events By Hour)
    if (activityChart && metrics.eventsByHour) {
        const sortedKeys = Object.keys(metrics.eventsByHour).sort();
        const dataValues = sortedKeys.map(k => metrics.eventsByHour[k]);
        
        activityChart.data.labels = sortedKeys.length > 0 ? sortedKeys : ['Sin datos'];
        activityChart.data.datasets[0].data = dataValues.length > 0 ? dataValues : [0];
        activityChart.update();
    }

    // Update Severity Chart to Doughnut of ProcessCounts
    if (severityChart && metrics.processCounts) {
        const rootStyles = getComputedStyle(document.documentElement);
        const processLabels = Object.keys(metrics.processCounts);
        const processData = Object.values(metrics.processCounts);
        
        // Brand colors pool
        const colors = [
            rootStyles.getPropertyValue('--critical').trim(),
            rootStyles.getPropertyValue('--warning').trim(),
            rootStyles.getPropertyValue('--info').trim(),
            rootStyles.getPropertyValue('--primary').trim(),
            rootStyles.getPropertyValue('--secondary').trim(),
            rootStyles.getPropertyValue('--accent').trim()
        ];
        
        const bgColors = processLabels.map((_, i) => colors[i % colors.length]);

        severityChart.data.labels = processLabels.length > 0 ? processLabels : ['Sin Procesos'];
        severityChart.data.datasets[0].data = processData.length > 0 ? processData : [1];
        severityChart.data.datasets[0].backgroundColor = bgColors.length > 0 ? bgColors : ['#334155'];
        severityChart.update();
    }
    updateSchematicColors();
}

// 5.5 Helper functions for client-side sorting and header state
function sortData(array, column, direction) {
    const sorted = [...array].sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        // Normalize nulls and undefined
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        // Specific checks for dates / timestamps
        if (column === 'timestamp' || column === 'date') {
            return new Date(valA) - new Date(valB);
        }

        // Numeric checks
        if (typeof valA === 'number' && typeof valB === 'number') {
            return valA - valB;
        }

        // Case-insensitive string comparison
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();

        if (valA < valB) return -1;
        if (valA > valB) return 1;
        return 0;
    });

    if (direction === 'desc') {
        sorted.reverse();
    }
    return sorted;
}

function updateHeaderClasses(tableName) {
    const state = sortStates[tableName];
    if (!state) return;
    
    const headers = document.querySelectorAll(`.sortable-header[data-table="${tableName}"]`);
    headers.forEach(header => {
        header.classList.remove('asc', 'desc');
        if (header.getAttribute('data-column') === state.column) {
            header.classList.add(state.direction);
        }
    });
}

function handleHeaderSort(tableName, column) {
    if (!sortStates[tableName]) {
        sortStates[tableName] = { column: column, direction: 'asc' };
    } else {
        const state = sortStates[tableName];
        if (state.column === column) {
            state.direction = state.direction === 'asc' ? 'desc' : 'asc';
        } else {
            state.column = column;
            state.direction = 'asc';
        }
    }

    // Update headers UI
    updateHeaderClasses(tableName);

    // Re-render
    if (tableName === 'mini') {
        renderMiniTable();
    } else if (tableName === 'full') {
        renderFullTable();
    } else if (tableName === 'hardware') {
        renderHardwareView();
    } else if (tableName === 'dicom') {
        renderDicomView();
    } else if (tableName === 'maintenance') {
        renderMaintenanceView();
    } else if (tableName === 'stops') {
        renderStopsView();
    } else if (tableName === 'history') {
        updateHistoryView();
    }
}

// 6. Fetch log events
async function fetchLogs(queryParams = "") {
    try {
        const response = await fetch(`/api/data${queryParams}`);
        if (response.ok) {
            allEvents = await response.json() || [];
            
            // Render mini logs table (latest 10)
            renderMiniTable();
            
            // Process filters on full log view
            applyFullLogFilters();
        }
    } catch (err) {
        console.error("Error fetching logs data:", err);
    }
}

// 7. Render mini logs table
// 7. Render mini logs table
function renderMiniTable(events) {
    let dataList = [...allEvents];
    
    // Filter
    const searchVal = (searchQueries.mini || '').toLowerCase();
    if (searchVal) {
        dataList = dataList.filter(ev => 
            ev.message.toLowerCase().includes(searchVal) ||
            ev.process.toLowerCase().includes(searchVal)
        );
    }
    
    // Sort
    dataList = sortData(dataList, sortStates.mini.column, sortStates.mini.direction);
    updateHeaderClasses('mini');

    const tbody = document.getElementById('mini-logs-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const slice = dataList.slice(0, 10);
    if (slice.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay eventos de logs registrados</td></tr>';
        return;
    }

    slice.forEach(ev => {
        const tr = document.createElement('tr');
        
        const pillClass = getSeverityPillClass(ev.severity);

        const timestampStr = new Date(ev.timestamp).toLocaleTimeString();

        tr.innerHTML = `
            <td>${timestampStr}</td>
            <td><span class="pill ${pillClass}">${ev.severity}</span></td>
            <td>${ev.process}</td>
            <td>${escapeHtml(ev.message)}${getTicketBadgeHtml(ev)}</td>
        `;
        enhanceLogEventRow(tr, ev);
        tbody.appendChild(tr);
    });
}

// 8. Full Log View Operations (Filter, Pagination)
function applyFullLogFilters() {
    const searchText = document.getElementById('full-log-search').value.toLowerCase();
    const severity = document.getElementById('filter-severity').value;
    const process = document.getElementById('filter-process').value;

    filteredEvents = allEvents.filter(ev => {
        if (severity && ev.severity !== severity) return false;
        if (process && ev.process !== process) return false;
        
        if (searchText) {
            const matchMessage = ev.message.toLowerCase().includes(searchText);
            const matchProcess = ev.process.toLowerCase().includes(searchText);
            const matchHost = ev.host && ev.host.toLowerCase().includes(searchText);
            const matchGECode = ev.geCode && ev.geCode.toLowerCase().includes(searchText);
            
            if (!matchMessage && !matchProcess && !matchHost && !matchGECode) {
                return false;
            }
        }
        return true;
    });

    currentPage = 1;
    renderFullTable();
}

function renderFullTable() {
    let sortedList = [...filteredEvents];
    sortedList = sortData(sortedList, sortStates.full.column, sortStates.full.direction);
    updateHeaderClasses('full');

    const tbody = document.getElementById('full-logs-tbody');
    tbody.innerHTML = '';

    if (sortedList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No se encontraron registros coincidentes</td></tr>';
        document.getElementById('pagination-status').innerText = 'Mostrando 0-0 de 0';
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, sortedList.length);
    const paginatedItems = sortedList.slice(startIndex, endIndex);

    paginatedItems.forEach(ev => {
        const tr = document.createElement('tr');
        
        const pillClass = getSeverityPillClass(ev.severity);

        const dateStr = new Date(ev.timestamp).toLocaleString();
        const hostVal = ev.host || '-';
        const geCodeVal = ev.geCode || '-';

        tr.innerHTML = `
            <td>${dateStr}</td>
            <td><span class="pill ${pillClass}">${ev.severity}</span></td>
            <td><span class="pill pill-info" style="background: rgba(140, 80, 255, 0.15); color: #c09fff; border-color: rgba(140, 80, 255, 0.3); font-size: 11px;">${escapeHtml(ev.subsystem || '-')}</span></td>
            <td>
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #ff8c00;">${escapeHtml(ev.tceCode || '-')}</span>
                ${getTicketBadgeHtml(ev)}
                ${ev.tceCode ? `<button class="help-trigger-btn" data-code="${escapeHtml(ev.tceCode)}" style="background: none; border: none; padding: 0 4px; cursor: pointer; color: var(--primary);" title="Ayuda y manuales"><i data-lucide="help-circle" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i></button>` : ''}
            </td>
            <td>${ev.process}</td>
            <td>${escapeHtml(hostVal)}</td>
            <td><span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--accent);">${escapeHtml(geCodeVal)}</span></td>
            <td>${ev.source.split('/').pop()}</td>
            <td>${escapeHtml(ev.message)}</td>
        `;
        enhanceLogEventRow(tr, ev);
        tbody.appendChild(tr);
    });

    document.getElementById('pagination-status').innerText = `Mostrando ${startIndex + 1}-${endIndex} de ${sortedList.length}`;
}

// 9. Fetch YANG Config Tree
async function fetchYangTree() {
    if (yangTreeLoaded) return;
    try {
        const response = await fetch('/api/yang');
        if (response.ok) {
            const rootNode = await response.json();
            const container = document.getElementById('yang-tree-root');
            container.innerHTML = '';
            container.appendChild(renderYangNode(rootNode));
            lucide.createIcons(); // refresh newly rendered chevron icons
            yangTreeLoaded = true;
        }
    } catch (err) {
        console.error("Error fetching YANG tree:", err);
    }
}

// Recursive YANG HTML Node builder
function renderYangNode(node) {
    const div = document.createElement('div');
    div.className = 'tree-node';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'tree-node-content';

    if (node.type === 'container' || node.type === 'list') {
        contentDiv.classList.add('tree-folder');
        contentDiv.innerHTML = `
            <i data-lucide="chevron-down" class="chevron-icon"></i>
            <i data-lucide="folder"></i>
            <span>${node.name}</span>
            <span class="tree-type">[${node.type}]</span>
        `;

        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'tree-children';
        node.children.forEach(child => {
            childrenDiv.appendChild(renderYangNode(child));
        });

        // Toggle Collapse Event
        contentDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            contentDiv.classList.toggle('collapsed');
        });

        div.appendChild(contentDiv);
        div.appendChild(childrenDiv);
    } else {
        contentDiv.classList.add('tree-leaf');
        contentDiv.innerHTML = `
            <i data-lucide="file-code" style="width: 14px; height: 14px; margin-left: 18px;"></i>
            <span>${node.name}:</span>
            <span class="tree-val">${node.value}</span>
            <span class="tree-type">[leaf]</span>
        `;
        div.appendChild(contentDiv);
    }

    return div;
}

// 10. Fetch Server Status
async function fetchStatus() {
    try {
        const response = await fetch('/api/status');
        const dot = document.getElementById('connection-dot');
        const text = document.getElementById('connection-text');

        if (response.ok) {
            const statusData = await response.json();
            if (statusData.status === 'CONNECTED') {
                dot.className = 'dot dot-green';
                text.innerText = 'Conectado (SSH)';
            } else {
                dot.className = 'dot dot-red';
                text.innerText = 'Falla Conexión GE';
            }
        } else {
            dot.className = 'dot dot-red';
            text.innerText = 'Error Servidor';
        }
    } catch (err) {
        document.getElementById('connection-dot').className = 'dot dot-red';
        document.getElementById('connection-text').innerText = 'API Offline';
    }
}

// 11. Core Refresh function
async function refreshDashboard() {
    await fetchStatus();

    let queryParams = "";
    const df = document.getElementById('date-from').value;
    const dt = document.getElementById('date-to').value;
    const dashDate = document.getElementById('dash-date-filter').value;
    
    if (dashDate) {
        const params = new URLSearchParams();
        params.append('from', `${dashDate}T00:00:00Z`);
        params.append('to', `${dashDate}T23:59:59Z`);
        queryParams = `?${params.toString()}`;
    } else if (df || dt) {
        const params = new URLSearchParams();
        if (df) params.append('from', new Date(df).toISOString());
        if (dt) params.append('to', new Date(dt).toISOString());
        queryParams = `?${params.toString()}`;
    }
    
    // Fetch Metrics
    try {
        const response = await fetch(`/api/metrics${queryParams}`);
        if (response.ok) {
            const metrics = await response.json();
            updateMetricsUI(metrics);
        }
    } catch (err) {
        console.error("Error loading metrics:", err);
    }

    // Fetch Logs
    await fetchLogs(queryParams);

    // Fetch and load classification data
    await loadClassificationData(null, queryParams, true);

    // Fetch and load history if active
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav && activeNav.getAttribute('data-view') === 'history') {
        await loadHistoryData(queryParams, true);
    }
}

// 12. Auto-Refresh countdown loop
function startCountdown() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);

    const refreshRing = document.getElementById('refresh-ring');
    
    autoRefreshTimer = setInterval(() => {
        timeLeft--;
        const percentage = (timeLeft / refreshInterval) * 100;
        refreshRing.style.strokeDasharray = `${percentage}, 100`;

        if (timeLeft <= 0) {
            timeLeft = refreshInterval;
            refreshDashboard();
        }
    }, 1000);
}

// 13. Event Listeners for Filters & Controls
document.getElementById('full-log-search').addEventListener('input', applyFullLogFilters);
document.getElementById('filter-severity').addEventListener('change', applyFullLogFilters);
document.getElementById('filter-process').addEventListener('change', applyFullLogFilters);

document.getElementById('date-from').addEventListener('change', () => {
    isDateFilterManual = true;
    document.getElementById('dash-date-filter').value = '';
    refreshDashboard();
});
document.getElementById('date-to').addEventListener('change', () => {
    isDateFilterManual = true;
    document.getElementById('dash-date-filter').value = '';
    refreshDashboard();
});
document.getElementById('dash-date-filter').addEventListener('change', () => {
    isDateFilterManual = true;
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    refreshDashboard();
});

document.getElementById('clear-filters').addEventListener('click', () => {
    isDateFilterManual = false;
    // Limpiar todos los inputs visuales
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    document.getElementById('dash-date-filter').value = '';
    document.getElementById('full-log-search').value = '';
    document.getElementById('filter-severity').value = '';
    document.getElementById('filter-process').value = '';
    
    // Volver a hacer fetch sin filtros
    refreshDashboard();
});

// Search query event listeners
document.getElementById('mini-search').addEventListener('input', (e) => {
    searchQueries.mini = e.target.value;
    renderMiniTable();
});

const hwSearch = document.getElementById('hardware-search');
if (hwSearch) {
    hwSearch.addEventListener('input', (e) => {
        searchQueries.hardware = e.target.value;
        renderHardwareView();
    });
}

const dicomSearch = document.getElementById('dicom-search');
if (dicomSearch) {
    dicomSearch.addEventListener('input', (e) => {
        searchQueries.dicom = e.target.value;
        renderDicomView();
    });
}

const maintSearch = document.getElementById('maintenance-search');
if (maintSearch) {
    maintSearch.addEventListener('input', (e) => {
        searchQueries.maintenance = e.target.value;
        renderMaintenanceView();
    });
}

const stopsSearch = document.getElementById('stops-search');
if (stopsSearch) {
    stopsSearch.addEventListener('input', (e) => {
        searchQueries.stops = e.target.value;
        renderStopsView();
    });
}

const histSearch = document.getElementById('history-search');
if (histSearch) {
    histSearch.addEventListener('input', (e) => {
        searchQueries.history = e.target.value;
        updateHistoryView();
    });
}

const histDateSelect = document.getElementById('history-date-select');
if (histDateSelect) {
    histDateSelect.addEventListener('change', () => {
        updateHistoryView();
    });
}

// Global delegated event listener for sortable headers
document.body.addEventListener('click', (e) => {
    const header = e.target.closest('.sortable-header');
    if (!header) return;
    
    const table = header.getAttribute('data-table');
    const column = header.getAttribute('data-column');
    if (table && column) {
        handleHeaderSort(table, column);
    }
});

// Pagination controls
document.getElementById('btn-prev').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderFullTable();
    }
});
document.getElementById('btn-next').addEventListener('click', () => {
    if (currentPage * itemsPerPage < filteredEvents.length) {
        currentPage++;
        renderFullTable();
    }
});

// YANG controls
document.getElementById('tree-expand-all').addEventListener('click', () => {
    document.querySelectorAll('.tree-folder').forEach(folder => {
        folder.classList.remove('collapsed');
    });
});
document.getElementById('tree-collapse-all').addEventListener('click', () => {
    document.querySelectorAll('.tree-folder').forEach(folder => {
        folder.classList.add('collapsed');
    });
});

// Manual refresh
document.getElementById('manual-refresh').addEventListener('click', () => {
    timeLeft = refreshInterval;
    refreshDashboard();
});

// Config Settings Form listener
document.getElementById('setting-refresh').addEventListener('change', (e) => {
    const val = parseInt(e.target.value);
    if (val >= 5 && val <= 300) {
        refreshInterval = val;
        timeLeft = refreshInterval;
    }
});

// Utility HTML escape
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 14.5 Load & Render Classification Views (Alerts, Hardware, DICOM, Maintenance, Stops)
async function loadClassificationData(activeView = null, queryParams = "", force = false) {
    if (!activeView) {
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) {
            activeView = activeNav.getAttribute('data-view');
        }
    }

    // Check if caching criteria is met (same parameters, not forced, and cache exists)
    if (!force && lastClassificationParams === queryParams && Object.keys(cachedClassification).length > 0) {
        if (activeView === 'alerts') {
            renderAlertsView(cachedClassification.alerts);
        } else if (activeView === 'hardware') {
            renderHardwareView();
        } else if (activeView === 'dicom') {
            renderDicomView();
        } else if (activeView === 'maintenance') {
            renderMaintenanceView();
        } else if (activeView === 'stops') {
            renderStopsView();
        }
        return;
    }
    lastClassificationParams = queryParams;

    try {
        const response = await fetch(`/api/classification${queryParams}`);
        if (!response.ok) return;
        const data = await response.json();

        // Update date filter input value if empty and a date is returned
        const dateInput = document.getElementById('dash-date-filter');
        if (dateInput && !dateInput.value && data.activeDate) {
            dateInput.value = data.activeDate;
        }

        // Update Hardware KPIs dynamically
        updateHardwareKPIs(data);

        // Update the global Navigation badge
        const badge = document.getElementById('alerts-badge');
        if (badge) {
            if (data.alertsCount > 0) {
                badge.innerText = data.alertsCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        // Cache the fetched data
        if (data.alerts) cachedClassification.alerts = data.alerts;
        if (data.hardware) cachedClassification.hardware = data.hardware;
        if (data.dicom) cachedClassification.dicom = data.dicom;
        if (data.maintenance) cachedClassification.maintenance = data.maintenance;
        if (data.stops) cachedClassification.stops = data.stops;

        // Render target view if it matches the active tab
        if (activeView === 'alerts') {
            renderAlertsView(cachedClassification.alerts);
        } else if (activeView === 'hardware') {
            renderHardwareView();
        } else if (activeView === 'dicom') {
            renderDicomView();
        } else if (activeView === 'maintenance') {
            renderMaintenanceView();
        } else if (activeView === 'stops') {
            renderStopsView();
        }
    } catch (err) {
        console.error("Error loading classification data:", err);
    }
}

function renderAlertsView(alerts) {
    const container = document.getElementById('alerts-container');
    if (!container) return;
    container.innerHTML = '';

    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="text-center padding-all glass-panel" style="grid-column: 1 / -1; padding: 40px;">
                <i data-lucide="shield-check" class="text-success" style="width: 48px; height: 48px; color: var(--primary); margin: 0 auto 12px; display: block;"></i>
                <h4 style="color: var(--text);">No hay alertas críticas en las últimas 24 horas</h4>
                <p class="text-secondary" style="margin-top: 8px;">El tomógrafo se encuentra operando dentro de los límites de tolerancia normales.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    alerts.slice(0, 100).forEach(ev => {
        const item = document.createElement('div');
        const isCritical = ev.severity === 'SEVERE_ERROR' || ev.severity === 'CRITICAL';
        item.className = `alert-item glass-panel ${isCritical ? 'danger' : 'warning'}`;

        const iconName = isCritical ? 'shield-alert' : 'alert-triangle';
        const dateStr = new Date(ev.timestamp).toLocaleString();

        item.innerHTML = `
            <div class="alert-icon"><i data-lucide="${iconName}"></i></div>
            <div class="alert-details">
                <h4 style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #ff8c00;">
                        ${escapeHtml(ev.tceCode || 'ALERTA DE TELEMETRÍA')}
                        ${ev.tceCode ? `<button class="help-trigger-btn" data-code="${escapeHtml(ev.tceCode)}" style="background: none; border: none; padding: 0 4px; cursor: pointer; color: var(--primary);" title="Ayuda y manuales"><i data-lucide="help-circle" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i></button>` : ''}
                    </span>
                    <span style="font-size: 0.75rem; opacity: 0.7; font-weight: normal;">${dateStr}</span>
                </h4>
                <p style="margin: 8px 0; font-size: 0.95rem; color: var(--text);">${escapeHtml(ev.message)}</p>
                <span class="alert-meta" style="font-size: 0.75rem; opacity: 0.6;">Proceso: ${escapeHtml(ev.process)} | Subsistema: ${escapeHtml(ev.subsystem || 'N/A')}</span>
            </div>
        `;
        container.appendChild(item);
    });
    lucide.createIcons();
}

function updateHardwareKPIs(data) {
    const maxMasLimit = data.activeTubeEolMasMin || (currentHealthConfig ? currentHealthConfig.rated_mas_capacity : 600000);
    const maxRevsLimit = parseInt(localStorage.getItem('max-revs-limit')) || 100000;
    const maxTempLimit = currentHealthConfig ? currentHealthConfig.n_max_thermal : 120; // 120 °C is standard CT cooling index maximum

    // 1. mAs Accumulation
    const masVal = data.totalMas || 0;
    const masPercent = Math.min(100, Math.round((masVal / maxMasLimit) * 100));
    const masFill = document.getElementById('hw-mas-fill');
    const masText = document.getElementById('hw-mas-val');
    if (masFill) masFill.style.width = masPercent + '%';
    if (masText) masText.innerText = `${masVal.toLocaleString()} / ${maxMasLimit.toLocaleString()} mAs (${masPercent}%)`;

    // Update Tube details elements if returned
    const modelVal = document.getElementById('hw-tube-model-val');
    const bearingVal = document.getElementById('hw-tube-bearing-val');
    const capacityVal = document.getElementById('hw-tube-capacity-val');
    const insertVal = document.getElementById('hw-tube-insert-val');
    const housingVal = document.getElementById('hw-tube-housing-val');

    if (modelVal && data.activeTubeModel) modelVal.innerText = data.activeTubeModel;
    if (bearingVal && data.activeTubeBearing) bearingVal.innerText = data.activeTubeBearing;
    if (capacityVal && data.activeTubeEolMasMax) capacityVal.innerText = `${(data.activeTubeEolMasMin/1000000).toFixed(0)} - ${(data.activeTubeEolMasMax/1000000).toFixed(0)}M mAs`;
    else if (capacityVal && data.activeTubeEolMasMin) capacityVal.innerText = `${(data.activeTubeEolMasMin/1000000).toFixed(0)}M mAs`;
    if (insertVal) insertVal.innerText = data.activeTubeInsertRef || '-';
    if (housingVal) housingVal.innerText = data.activeTubeHousing || '-';

    // 2. Gantry Rotations
    const revsVal = data.totalRevs || 0;
    const revsPercent = Math.min(100, Math.round((revsVal / maxRevsLimit) * 100));
    const revsFill = document.getElementById('hw-revs-fill');
    const revsText = document.getElementById('hw-revs-val');
    if (revsFill) {
        revsFill.style.width = revsPercent + '%';
    }
    if (revsText) {
        revsText.innerText = `${revsVal.toLocaleString()} Rotaciones`;
    }
    const revsDesc = document.getElementById('hw-revs-desc');
    if (revsDesc) {
        revsDesc.innerText = `Próximo servicio mecánico recomendado a las ${maxRevsLimit.toLocaleString()} rotaciones.`;
    }

    // 3. Filament Temperature
    const tempVal = data.maxTemp || 0;
    const tempPercent = Math.min(100, Math.round((tempVal / maxTempLimit) * 100));
    const tempFill = document.getElementById('hw-temp-fill');
    const tempText = document.getElementById('hw-temp-val');
    if (tempFill) {
        tempFill.style.width = tempPercent + '%';
    }
    if (tempText) {
        tempText.innerText = tempVal > 0 ? `${tempVal.toFixed(1)} °C (Filamento)` : '0 °C (Filamento)';
    }
}

function renderHardwareView(hardware) {
    if (hardware !== undefined) {
        cachedClassification.hardware = hardware;
    }
    let dataList = [...(cachedClassification.hardware || [])];

    // Filter
    const searchVal = (searchQueries.hardware || '').toLowerCase();
    if (searchVal) {
        dataList = dataList.filter(ev => 
            ev.message.toLowerCase().includes(searchVal) ||
            (ev.subsystem && ev.subsystem.toLowerCase().includes(searchVal)) ||
            (ev.tceCode && ev.tceCode.toLowerCase().includes(searchVal)) ||
            (ev.severity && ev.severity.toLowerCase().includes(searchVal))
        );
    }

    // Sort
    dataList = sortData(dataList, sortStates.hardware.column, sortStates.hardware.direction);
    updateHeaderClasses('hardware');

    const tbody = document.getElementById('hardware-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (dataList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay registros de hardware coincidentes</td></tr>';
        return;
    }

    dataList.slice(0, 50).forEach(ev => {
        const tr = document.createElement('tr');
        const pillClass = getSeverityPillClass(ev.severity);

        tr.innerHTML = `
            <td>${new Date(ev.timestamp).toLocaleString()}</td>
            <td><span class="pill pill-info" style="background: rgba(140, 80, 255, 0.15); color: #c09fff; border-color: rgba(140, 80, 255, 0.3); font-size: 11px;">${escapeHtml(ev.subsystem || 'Hardware')}</span></td>
            <td><span class="pill ${pillClass}">${ev.severity}</span></td>
            <td>
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #ff8c00;">${escapeHtml(ev.tceCode || '-')}</span>
                ${getTicketBadgeHtml(ev)}
            </td>
            <td>${escapeHtml(ev.message)}</td>
        `;
        enhanceLogEventRow(tr, ev);
        tbody.appendChild(tr);
    });
}

function renderDicomView(dicom) {
    if (dicom !== undefined) {
        cachedClassification.dicom = dicom;
    }
    let dataList = [...(cachedClassification.dicom || [])];

    // Filter
    const searchVal = (searchQueries.dicom || '').toLowerCase();
    if (searchVal) {
        dataList = dataList.filter(ev => 
            ev.message.toLowerCase().includes(searchVal) ||
            (ev.subsystem && ev.subsystem.toLowerCase().includes(searchVal)) ||
            (ev.tceCode && ev.tceCode.toLowerCase().includes(searchVal)) ||
            (ev.severity && ev.severity.toLowerCase().includes(searchVal))
        );
    }

    // Sort
    dataList = sortData(dataList, sortStates.dicom.column, sortStates.dicom.direction);
    updateHeaderClasses('dicom');

    const tbody = document.getElementById('dicom-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (dataList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No se detectaron fallas de conectividad o DICOM coincidentes</td></tr>';
        return;
    }

    dataList.slice(0, 50).forEach(ev => {
        const tr = document.createElement('tr');
        const pillClass = getSeverityPillClass(ev.severity);

        tr.innerHTML = `
            <td>${new Date(ev.timestamp).toLocaleString()}</td>
            <td><span class="pill ${pillClass}">${ev.severity}</span></td>
            <td><span class="pill pill-info" style="font-size: 11px;">${escapeHtml(ev.subsystem || 'DICOM')}</span></td>
            <td>
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #ff8c00;">${escapeHtml(ev.tceCode || '-')}</span>
                ${getTicketBadgeHtml(ev)}
                ${ev.tceCode ? `<button class="help-trigger-btn" data-code="${escapeHtml(ev.tceCode)}" style="background: none; border: none; padding: 0 4px; cursor: pointer; color: var(--primary);" title="Ayuda y manuales"><i data-lucide="help-circle" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i></button>` : ''}
            </td>
            <td>${escapeHtml(ev.message)}</td>
        `;
        enhanceLogEventRow(tr, ev);
        tbody.appendChild(tr);
    });
}

function renderMaintenanceView(maintenance) {
    if (maintenance !== undefined) {
        cachedClassification.maintenance = maintenance;
    }
    let dataList = [...(cachedClassification.maintenance || [])];

    // Filter
    const searchVal = (searchQueries.maintenance || '').toLowerCase();
    if (searchVal) {
        dataList = dataList.filter(ev => 
            ev.message.toLowerCase().includes(searchVal) ||
            (ev.tceCode && ev.tceCode.toLowerCase().includes(searchVal)) ||
            (ev.severity && ev.severity.toLowerCase().includes(searchVal))
        );
    }

    // Sort
    dataList = sortData(dataList, sortStates.maintenance.column, sortStates.maintenance.direction);
    updateHeaderClasses('maintenance');

    const tbody = document.getElementById('maintenance-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (dataList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay alertas térmicas registradas para el Tubo coincidentes</td></tr>';
        return;
    }

    dataList.slice(0, 50).forEach(ev => {
        const tr = document.createElement('tr');
        const pillClass = getSeverityPillClass(ev.severity);

        tr.innerHTML = `
            <td>${new Date(ev.timestamp).toLocaleString()}</td>
            <td><span class="pill ${pillClass}">${ev.severity}</span></td>
            <td>
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #ff8c00;">${escapeHtml(ev.tceCode || '-')}</span>
                ${getTicketBadgeHtml(ev)}
                ${ev.tceCode ? `<button class="help-trigger-btn" data-code="${escapeHtml(ev.tceCode)}" style="background: none; border: none; padding: 0 4px; cursor: pointer; color: var(--primary);" title="Ayuda y manuales"><i data-lucide="help-circle" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i></button>` : ''}
            </td>
            <td style="color: var(--warning);">${escapeHtml(ev.message)}</td>
        `;
        enhanceLogEventRow(tr, ev);
        tbody.appendChild(tr);
    });
}

function renderStopsView(stops) {
    if (stops !== undefined) {
        cachedClassification.stops = stops;
    }
    
    let stopsArray = [];
    if (cachedClassification.stops) {
        Object.keys(cachedClassification.stops).forEach(date => {
            stopsArray.push({
                date: date,
                count: cachedClassification.stops[date]
            });
        });
    }

    // Filter
    const searchVal = (searchQueries.stops || '').toLowerCase();
    if (searchVal) {
        stopsArray = stopsArray.filter(item => 
            item.date.toLowerCase().includes(searchVal)
        );
    }

    // Sort
    stopsArray = sortData(stopsArray, sortStates.stops.column, sortStates.stops.direction);
    updateHeaderClasses('stops');

    const tbody = document.getElementById('stops-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (stopsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-center">No se registran escaneos abortados o fallidos coincidentes</td></tr>';
        return;
    }

    stopsArray.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${item.date}</td>
            <td style="color: var(--critical); font-weight: bold; font-family: 'JetBrains Mono', monospace;">
                <span class="pill pill-critical" style="padding: 4px 10px; font-size: 11px; font-weight: bold;">
                    ${item.count} abortos / detenciones
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 15. Load History Data
async function loadHistoryData(queryParams = "", force = false) {
    const loadingEl = document.getElementById('history-loading');
    const errorEl = document.getElementById('history-error');
    const emptyEl = document.getElementById('history-empty');
    const contentEl = document.getElementById('history-content');

    if (!force && lastHistoryParams === queryParams && cachedHistory && Object.keys(cachedHistory).length > 0) {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (errorEl) errorEl.classList.add('hidden');
        if (emptyEl) emptyEl.classList.add('hidden');
        if (contentEl) contentEl.classList.remove('hidden');
        updateHistoryView();
        return;
    }
    lastHistoryParams = queryParams;

    const isBackgroundRefresh = force && cachedHistory && Object.keys(cachedHistory).length > 0;

    if (!isBackgroundRefresh) {
        // Show loading state only on initial load or manual force without cache
        loadingEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        contentEl.innerHTML = '';
    }
    errorEl.classList.add('hidden');
    emptyEl.classList.add('hidden');

    try {
        const response = await fetch(`/api/history${queryParams}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        cachedHistory = await response.json();
        
        // Extract unique days
        const uniqueDays = [...new Set(Object.keys(cachedHistory).map(k => k.split(' ')[0]))]
            .sort((a, b) => new Date(b) - new Date(a));
        
        // Populate dropdown
        const selectEl = document.getElementById('history-date-select');
        if (selectEl) {
            const previousVal = selectEl.value;
            selectEl.innerHTML = '';
            
            uniqueDays.forEach(day => {
                const opt = document.createElement('option');
                opt.value = day;
                opt.innerText = day;
                selectEl.appendChild(opt);
            });
            
            // Add a "Show All" option
            const allOpt = document.createElement('option');
            allOpt.value = 'all';
            allOpt.innerText = 'Todos los días';
            selectEl.appendChild(allOpt);

            // Restore selection or default to the first (latest) day if not set or not valid
            if (previousVal && (uniqueDays.includes(previousVal) || previousVal === 'all')) {
                selectEl.value = previousVal;
            } else if (uniqueDays.length > 0) {
                selectEl.value = uniqueDays[0];
            } else {
                selectEl.value = 'all';
            }
        }
        
        if (!isBackgroundRefresh) {
            // Hide loading only if we explicitly showed it
            loadingEl.classList.add('hidden');
        }
        
        updateHistoryView();
    } catch (err) {
        console.error("Error loading history logs:", err);
        if (!isBackgroundRefresh) {
            loadingEl.classList.add('hidden');
        }
        errorEl.classList.remove('hidden');
    }
}

function updateHistoryView() {
    const historySection = document.getElementById('history');
    const savedScrollTop = historySection ? historySection.scrollTop : 0;

    const emptyEl = document.getElementById('history-empty');
    const contentEl = document.getElementById('history-content');
    contentEl.innerHTML = '';

    // Filter events of cachedHistory
    const searchVal = (searchQueries.history || '').toLowerCase();
    
    // Get the selected day from the dropdown
    const selectEl = document.getElementById('history-date-select');
    const selectedDay = selectEl ? selectEl.value : 'all';

    // Grouped filtered data
    let filteredHistory = {};
    let hasAnyEvents = false;

    Object.keys(cachedHistory).forEach(date => {
        // If a specific day is selected, filter by that day prefix (e.g. YYYY-MM-DD)
        if (selectedDay && selectedDay !== 'all' && !date.startsWith(selectedDay)) {
            return;
        }

        const events = cachedHistory[date].filter(ev => {
            if (!searchVal) return true;
            return (
                ev.message.toLowerCase().includes(searchVal) ||
                ev.severity.toLowerCase().includes(searchVal) ||
                (ev.subsystem && ev.subsystem.toLowerCase().includes(searchVal)) ||
                (ev.tceCode && ev.tceCode.toLowerCase().includes(searchVal)) ||
                (ev.process && ev.process.toLowerCase().includes(searchVal)) ||
                (ev.host && ev.host.toLowerCase().includes(searchVal))
            );
        });

        if (events.length > 0) {
            filteredHistory[date] = events;
            hasAnyEvents = true;
        }
    });

    // Check if there is any date group returned after filtering
    const dates = Object.keys(filteredHistory).sort((a, b) => new Date(b) - new Date(a));
    if (!hasAnyEvents || dates.length === 0) {
        emptyEl.classList.remove('hidden');
        contentEl.classList.add('hidden');
        return;
    } else {
        emptyEl.classList.add('hidden');
    }

    let renderedCount = 0;
    const MAX_RENDER_LIMIT = 100;
    let reachedLimit = false;

    const fragment = document.createDocumentFragment();

    // Render each date group
    dates.forEach(date => {
        if (reachedLimit) return;

        const dateSection = document.createElement('div');
        dateSection.className = 'history-date-group';
        dateSection.style.marginBottom = '28px';
        
        // Convert date header to local timezone if it contains time
        let displayDate = date;
        if (date.includes(' ')) {
            const utcStr = date.replace(' ', 'T') + ':00Z';
            const parsedDate = new Date(utcStr);
            if (!isNaN(parsedDate.getTime())) {
                const pad = (n) => n.toString().padStart(2, '0');
                displayDate = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())} ${pad(parsedDate.getHours())}:00`;
            }
        }

        // Sub-header for the date
        const header = document.createElement('div');
        header.className = 'section-title';
        header.style.marginTop = '16px';
        header.style.marginBottom = '12px';
        header.style.fontSize = '1rem';
        header.style.borderBottom = '1px dashed rgba(255, 255, 255, 0.1)';
        header.style.paddingBottom = '6px';
        header.innerText = displayDate;
        dateSection.appendChild(header);

        // Table Wrapper
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';
        
        const table = document.createElement('table');
        table.className = 'glass-table';
        
        table.innerHTML = `
            <thead>
                <tr>
                    <th class="sortable-header" data-column="id" data-table="history" style="width: 8%"># Reg.</th>
                    <th class="sortable-header" data-column="timestamp" data-table="history" style="width: 10%">Hora</th>
                    <th class="sortable-header" data-column="severity" data-table="history" style="width: 10%">Severidad</th>
                    <th class="sortable-header" data-column="subsystem" data-table="history" style="width: 12%">Subsistema</th>
                    <th class="sortable-header" data-column="tceCode" data-table="history" style="width: 15%">Código TCE</th>
                    <th class="sortable-header" data-column="process" data-table="history" style="width: 12%">Proceso</th>
                    <th class="sortable-header" data-column="host" data-table="history" style="width: 10%">Host</th>
                    <th class="sortable-header" data-column="message" data-table="history" style="width: 23%">Mensaje Resumido</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        
        const tbody = table.querySelector('tbody');
        
        // Sort events of this group using sortData
        let events = [...filteredHistory[date]];
        events = sortData(events, sortStates.history.column, sortStates.history.direction);
        
        events.forEach(ev => {
            if (renderedCount >= MAX_RENDER_LIMIT) {
                reachedLimit = true;
                return;
            }

            const tr = document.createElement('tr');
            const pillClass = getSeverityPillClass(ev.severity);

            const timeStr = new Date(ev.timestamp).toLocaleTimeString();
            const processStr = ev.process || '-';
            const hostStr = ev.host || '-';
            
            // Shortened message summary (max 80 chars)
            let msgSummary = ev.message || '';
            if (msgSummary.length > 80) {
                msgSummary = msgSummary.substring(0, 77) + '...';
            }

            tr.innerHTML = `
                <td><span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-dim);">#${escapeHtml(ev.id || '-')}</span></td>
                <td>${timeStr}</td>
                <td><span class="pill ${pillClass}">${ev.severity}</span></td>
                <td><span class="pill pill-info" style="background: rgba(140, 80, 255, 0.15); color: #c09fff; border-color: rgba(140, 80, 255, 0.3); font-size: 11px;">${escapeHtml(ev.subsystem || '-')}</span></td>
                <td>
                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #ff8c00;">${escapeHtml(ev.tceCode || '-')}</span>
                    ${getTicketBadgeHtml(ev)}
                    ${ev.tceCode ? `<button class="help-trigger-btn" data-code="${escapeHtml(ev.tceCode)}" style="background: none; border: none; padding: 0 4px; cursor: pointer; color: var(--primary);" title="Ayuda y manuales"><i data-lucide="help-circle" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle;"></i></button>` : ''}
                </td>
                <td>${escapeHtml(processStr)}</td>
                <td>${escapeHtml(hostStr)}</td>
                <td>${escapeHtml(msgSummary)}</td>
            `;
            enhanceLogEventRow(tr, ev);
            tbody.appendChild(tr);
            renderedCount++;
        });
        
        tableWrapper.appendChild(table);
        dateSection.appendChild(tableWrapper);
        fragment.appendChild(dateSection);
    });

    if (reachedLimit) {
        const limitBanner = document.createElement('div');
        limitBanner.style.background = 'rgba(255, 140, 0, 0.1)';
        limitBanner.style.border = '1px solid rgba(255, 140, 0, 0.2)';
        limitBanner.style.color = '#ff8c00';
        limitBanner.style.padding = '12px 16px';
        limitBanner.style.borderRadius = '8px';
        limitBanner.style.marginTop = '16px';
        limitBanner.style.textAlign = 'center';
        limitBanner.style.fontSize = '0.85rem';
        limitBanner.innerHTML = '<strong>Aviso de Rendimiento:</strong> Se están mostrando únicamente los 100 eventos más recientes. Utilice la barra de búsqueda o el selector de fecha para filtrar eventos específicos.';
        fragment.appendChild(limitBanner);
    }

    contentEl.appendChild(fragment);

    // Restore the scroll position so it doesn't jump to the top
    if (historySection) {
        historySection.scrollTop = savedScrollTop;
    }

    // Update active header classes for this view
    updateHeaderClasses('history');

    // Show content
    contentEl.classList.remove('hidden');
    lucide.createIcons();
}

// 14. Bootstrap application
window.addEventListener('DOMContentLoaded', () => {
    initCharts();
    refreshDashboard();
    startCountdown();
    loadConfigMode();
    initUserRole();

    // Bind toggle button from dashboard mode banner
    const toggleBtn = document.getElementById('btn-toggle-mode-dash');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
            toggleBtn.disabled = true;
            try {
                // Get current mode
                const res = await fetch('/api/config');
                if (res.ok) {
                    const cfg = await res.json();
                    const currentMode = cfg.operationMode || "online";
                    const newMode = currentMode === "online" ? "service" : "online";
                    
                    // Save new mode
                    const saveRes = await fetch('/api/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ operationMode: newMode })
                    });
                    
                    if (saveRes.ok) {
                        await loadConfigMode();
                        refreshDashboard();
                    } else {
                        alert("Error al cambiar el modo de operación.");
                    }
                }
            } catch (err) {
                console.error("Error toggling operation mode:", err);
            } finally {
                toggleBtn.disabled = false;
            }
        });
    }
});

// ============================================================================
// NEW FEATURES IMPLEMENTATION
// ============================================================================

// 1. Technical Help / Service Manuals / Engineer experience Modal
let currentHelpCode = "";

async function openHelpModal(code) {
    currentHelpCode = code;
    const titleEl = document.getElementById('modal-error-title');
    const theoryEl = document.getElementById('modal-theory-text');
    const inputEl = document.getElementById('modal-practice-input');
    const modalEl = document.getElementById('help-modal');

    if (titleEl) titleEl.innerText = `Ayuda Técnica - Código: ${code}`;
    if (theoryEl) theoryEl.innerText = "Buscando manuales técnicos...";
    if (inputEl) inputEl.value = "";

    // Show modal
    if (modalEl) modalEl.classList.remove('hidden');

    try {
        const res = await fetch('/api/knowledge');
        if (res.ok) {
            const kb = await res.json();
            const entry = kb[code];
            if (entry) {
                if (theoryEl) theoryEl.innerText = entry.theory || "No hay descripción teórica registrada en el manual.";
                if (inputEl) inputEl.value = entry.practice || "";
            } else {
                if (theoryEl) theoryEl.innerText = "Este código de evento no cuenta con definición teórica en los manuales de servicio cargados. Puedes iniciar la bitácora de experiencia técnica abajo.";
            }
        }
    } catch (err) {
        console.error("Error loading knowledge base:", err);
    }
    lucide.createIcons();
}

async function saveHelpExperience() {
    if (!currentHelpCode) return;
    const inputEl = document.getElementById('modal-practice-input');
    const practiceText = inputEl ? inputEl.value : "";

    try {
        const res = await fetch('/api/knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: currentHelpCode,
                practice: practiceText
            })
        });
        if (res.ok) {
            alert("Experiencia técnica guardada con éxito. Servirá para la resolución de futuras fallas y entrenamiento del agente de IA.");
            closeHelpModal();
        } else {
            alert("Error al guardar la experiencia.");
        }
    } catch (err) {
        console.error("Error saving knowledge base entry:", err);
    }
}

function closeHelpModal() {
    const modalEl = document.getElementById('help-modal');
    if (modalEl) modalEl.classList.add('hidden');
    currentHelpCode = "";
}

// Bind modal buttons
document.getElementById('close-help-modal').addEventListener('click', closeHelpModal);
document.getElementById('cancel-help-modal').addEventListener('click', closeHelpModal);
document.getElementById('save-help-modal').addEventListener('click', saveHelpExperience);

// Event delegation for help buttons
document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.help-trigger-btn');
    if (btn) {
        e.preventDefault();
        const code = btn.getAttribute('data-code');
        openHelpModal(code);
    }
});


// 2. SVG Schematic Dynamic Status & Click Filters
function updateSchematicColors() {
    const subsystems = ['console', 'ips', 'cooling', 'table', 'tube', 'das', 'gantry', 'collimator'];
    const statuses = {};
    subsystems.forEach(s => statuses[s] = 'healthy');

    // Scan allEvents to find worst severity for each subsystem
    allEvents.forEach(ev => {
        const sub = (ev.subsystem || '').toLowerCase();
        if (subsystems.includes(sub)) {
            let sev = (ev.severity || '').toUpperCase();
            if (sev === 'SEVERE_ERROR' || sev === 'CRITICAL' || sev === 'SEVERE') {
                statuses[sub] = 'critical';
            } else if (sev === 'WARNING' && statuses[sub] !== 'critical') {
                statuses[sub] = 'warning';
            }
        }
    });

    // Apply CSS classes to SVG groups
    subsystems.forEach(sub => {
        const el = document.getElementById(`svg-${sub}`);
        if (el) {
            el.classList.remove('svg-healthy', 'svg-warning', 'svg-critical');
            if (statuses[sub] === 'critical') {
                el.classList.add('svg-critical');
            } else if (statuses[sub] === 'warning') {
                el.classList.add('svg-warning');
            } else {
                el.classList.add('svg-healthy');
            }
        }
    });
}

// Bind SVG component clicks to filter Log Explorer
document.querySelectorAll('.svg-element').forEach(el => {
    el.addEventListener('click', () => {
        const sub = el.getAttribute('data-subsystem');
        if (sub) {
            // Switch to logs tab
            const logsTab = document.querySelector('.nav-item[data-view="logs"]');
            if (logsTab) {
                logsTab.click();
            }
            // Set search input to subsystem name
            const searchInput = document.getElementById('full-log-search');
            if (searchInput) {
                searchInput.value = sub;
                applyFullLogFilters();
            }
        }
    });
});


// 3. Maintenance Bitacora Management (Tickets Workflow)
let activeTicketId = null;
let allTickets = [];

async function loadMaintenanceRecords() {
    const container = document.getElementById('tickets-timeline-container');
    if (!container) return;

    try {
        const res = await fetch('/api/maintenance/records');
        if (!res.ok) return;
        allTickets = await res.json();
        
        container.innerHTML = "";
        if (allTickets.length === 0) {
            container.innerHTML = `
                <div class="text-center padding-all" style="padding: 20px;">
                    <p class="text-secondary">No hay tickets ni bitácoras registradas.</p>
                </div>
            `;
            return;
        }

        allTickets.forEach(ticket => {
            const item = document.createElement('div');
            
            // Determine border color based on severity
            let severityColor = "var(--info)";
            let severityLabel = "Warning";
            if (ticket.severity === 'critical') {
                severityColor = "var(--critical)";
                severityLabel = "Crítica";
            } else if (ticket.severity === 'major') {
                severityColor = "var(--warning)";
                severityLabel = "Mayor";
            } else if (ticket.severity === 'warning') {
                severityColor = "var(--warning)";
                severityLabel = "Warning";
            }

            item.className = "glass-panel";
            item.style = `margin-top: 10px; padding: 15px; border-left: 4px solid ${severityColor}; cursor: pointer; transition: all 0.2s;`;
            
            // Mouseover hover effects
            item.onmouseover = () => item.style.background = 'rgba(255,255,255,0.05)';
            item.onmouseout = () => item.style.background = 'transparent';
            
            // Click to open resolution panel
            item.onclick = () => openResolutionPanel(ticket.id);

            const statusLabel = ticket.status === 'closed' 
                ? `<p style="font-size: 0.8rem; color: var(--success); margin-top: 4px;">Cerrado - Revisado en sitio.</p>`
                : `<p style="font-size: 0.8rem; color: var(--info); margin-top: 4px;">Click para abrir y llenar bitácora en sitio &rarr;</p>`;

            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; pointer-events: none;">
                    <strong style="color: var(--text);">Ticket #${escapeHtml(ticket.id)}: ${escapeHtml(ticket.title)}</strong>
                    <span class="badge" style="background: ${severityColor}; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; color: #fff;">${severityLabel}</span>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 8px; pointer-events: none;">Asignado a: ${escapeHtml(ticket.engineer)} | Logs: ${escapeHtml(ticket.relatedLogs || 'N/A')}</p>
                ${statusLabel}
            `;
            container.appendChild(item);
        });
    } catch (err) {
        console.error("Error loading tickets:", err);
    }
}

// Function to open resolution panel and load ticket details
function openResolutionPanel(ticketId) {
    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    activeTicketId = ticketId;
    
    // Show resolution panel
    const panel = document.getElementById('ticket-resolution-panel');
    if (panel) {
        panel.classList.remove('hidden');
    }

    // Set panel title
    const titleElem = document.getElementById('resolution-panel-title');
    if (titleElem) {
        titleElem.textContent = `3. En Sitio: Resolución y Bitácora - Ticket #${ticket.id}`;
    }

    // Populate fields
    document.getElementById('review-general').value = ticket.reviewGeneral || "";
    document.getElementById('diagnosis').value = ticket.diagnosis || "";

    // Render tasks
    renderTasks(ticket.tasks);
}

// Render dynamic task list inside resolution panel
function renderTasks(tasks) {
    const container = document.getElementById('tasks-container');
    if (!container) return;

    container.innerHTML = "";

    // Default to at least two empty tasks if none exist
    const tasksToRender = (tasks && tasks.length > 0) ? tasks : [{action: "", result: ""}, {action: "", result: ""}];

    tasksToRender.forEach((task, idx) => {
        addTaskRow(task.action, task.result, idx === 0);
    });
}

// Add a single task input row
function addTaskRow(action = "", result = "", isFirst = false) {
    const container = document.getElementById('tasks-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'task-item';
    div.style = 'display: flex; gap: 15px; margin-bottom: 12px; align-items: flex-start;';

    let labelAction = "";
    let labelResult = "";
    if (isFirst) {
        labelAction = `<label style="font-size: 0.8rem; margin-bottom: 4px; display: block; color: var(--text-dim);">Acción Tomada</label>`;
        labelResult = `<label style="font-size: 0.8rem; margin-bottom: 4px; display: block; color: var(--text-dim);">Resultado / Observación</label>`;
    }

    div.innerHTML = `
        <div style="flex: 1;">
            ${labelAction}
            <input type="text" class="glass-input task-action" value="${escapeHtml(action)}" placeholder="Ej. Inspección de cableado...">
        </div>
        <div style="flex: 1;">
            ${labelResult}
            <input type="text" class="glass-input task-result" value="${escapeHtml(result)}" placeholder="Ej. Cable desconectado...">
        </div>
    `;
    container.appendChild(div);
}

// Bind ticket creation (Operator form)
const ticketForm = document.getElementById('ticket-form');
if (ticketForm) {
    ticketForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('ticket-title').value;
        const severity = document.getElementById('ticket-severity').value;
        const engineer = document.getElementById('ticket-engineer').value;
        const relatedLogs = document.getElementById('ticket-logs').value;

        const ticketPayload = {
            title,
            severity,
            engineer,
            relatedLogs,
            status: 'open'
        };

        try {
            const res = await fetch('/api/maintenance/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ticketPayload)
            });

            if (res.ok) {
                ticketForm.reset();
                loadMaintenanceRecords();
                alert("Ticket abierto y asignado exitosamente al ingeniero de campo.");
            } else {
                alert("Error al abrir el ticket en el servidor.");
            }
        } catch (err) {
            console.error("Error creating ticket:", err);
            alert("Error de conexión al guardar el ticket.");
        }
    });
}

// Bind ticket resolution (Engineer form)
const resolutionForm = document.getElementById('resolution-form');
if (resolutionForm) {
    resolutionForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!activeTicketId) {
            alert("No hay ningún ticket activo seleccionado.");
            return;
        }

        const ticket = allTickets.find(t => t.id === activeTicketId);
        if (!ticket) return;

        const reviewGeneral = document.getElementById('review-general').value;
        const diagnosis = document.getElementById('diagnosis').value;

        // Collect dynamic tasks
        const tasks = [];
        const taskItems = document.querySelectorAll('#tasks-container .task-item');
        taskItems.forEach(item => {
            const action = item.querySelector('.task-action').value.trim();
            const result = item.querySelector('.task-result').value.trim();
            if (action || result) {
                tasks.push({ action, result });
            }
        });

        // Prepare updated ticket payload
        const updatedTicket = {
            ...ticket,
            status: 'closed',
            dateClosed: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
            reviewGeneral,
            diagnosis,
            tasks
        };

        try {
            const res = await fetch('/api/maintenance/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTicket)
            });

            if (res.ok) {
                document.getElementById('ticket-resolution-panel').classList.add('hidden');
                loadMaintenanceRecords();
                alert("Bitácora guardada y ticket cerrado exitosamente.");
            } else {
                alert("Error al cerrar el ticket en el servidor.");
            }
        } catch (err) {
            console.error("Error resolving ticket:", err);
            alert("Error de conexión al guardar la resolución.");
        }
    });
}

// Bind add task button
const btnAddTask = document.getElementById('btn-add-task');
if (btnAddTask) {
    btnAddTask.addEventListener('click', () => {
        // Find if there is already a first item to determine if we should label it (we don't for new items)
        const hasItems = document.querySelectorAll('#tasks-container .task-item').length > 0;
        addTaskRow("", "", !hasItems);
    });
}


// 4. Admin Alarm Classification Portal Management
let currentClassifications = {};
let loadedAlarms = [];

async function loadAdminClassifications(force = false) {
    if (!force && adminClassificationsLoaded) return;
    const tbody = document.getElementById('classifications-tbody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/admin/classifications');
        if (!res.ok) return;
        const data = await res.json();
        currentClassifications = data.overrides || {};
        loadedAlarms = data.alarms || [];

        renderClassificationsTable();
        adminClassificationsLoaded = true;
    } catch (err) {
        console.error("Error loading classifications:", err);
    }
}

function renderClassificationsTable() {
    const tbody = document.getElementById('classifications-tbody');
    if (!tbody) return;

    const query = (document.getElementById('classification-search')?.value || "").toLowerCase().trim();

    tbody.innerHTML = "";
    
    const filtered = loadedAlarms.filter(item => {
        return (item.code || "").toLowerCase().includes(query) || 
               (item.label || "").toLowerCase().includes(query) || 
               (item.description || "").toLowerCase().includes(query) ||
               (item.subsystem || "").toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding: 20px; color: var(--text-dim);">No se encontraron alarmas coincidentes.</td></tr>`;
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        if (item.isNew) {
            tr.style.background = "rgba(249, 212, 35, 0.03)";
        }
        
        // Severity pill mapping helper
        const getPill = (sev) => {
            const cls = getSeverityPillClass(sev);
            return `<span class="pill ${cls}">${sev}</span>`;
        };

        // Status badge
        let statusBadge = '';
        if (item.status === 'CONFIRMED') {
            statusBadge = `<span class="pill pill-success" style="font-size: 0.65rem;">CONFIRMED</span>`;
        } else {
            statusBadge = `<span class="pill pill-warning" style="font-size: 0.65rem;">PENDING</span>`;
        }

        const currentOverride = currentClassifications[item.code] || "";
        
        // Action cell: dropdown, plus a Confirmar button if pending
        let actionHtml = '';
        if (item.status === 'PENDING') {
            actionHtml = `
                <button class="btn btn-primary btn-confirm-alarm" data-code="${item.code}" data-severity="${item.defaultSeverity}" style="padding: 4px 8px; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;">
                    <i data-lucide="check" style="width: 12px; height: 12px;"></i> Confirmar
                </button>
            `;
        }

        tr.innerHTML = `
            <td>
                <div style="font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
                    ${item.label}
                    ${item.isNew ? '<span class="pill pill-warning" style="font-size: 0.6rem; padding: 1px 4px;">NUEVA</span>' : ''}
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">${item.code}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: 4px; font-style: italic;">${item.description}</div>
            </td>
            <td>
                <span class="pill pill-info" style="text-transform: uppercase;">${item.subsystem}</span>
            </td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                    ${statusBadge}
                    <div style="font-size: 0.68rem; color: var(--text-dim);">Base: ${getPill(item.defaultSeverity)}</div>
                </div>
            </td>
            <td>
                ${getPill(item.currentSeverity)}
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <select class="admin-select classification-select" data-code="${item.code}" style="padding: 4px 8px; font-size: 0.75rem;">
                        <option value="" ${currentOverride === '' ? 'selected' : ''}>[Por Defecto]</option>
                        <option value="CRITICAL" ${currentOverride === 'CRITICAL' ? 'selected' : ''}>CRITICAL</option>
                        <option value="WARNING" ${currentOverride === 'WARNING' || currentOverride === 'WARN_MINOR' || currentOverride === 'MAJOR_ERROR' ? 'selected' : ''}>WARNING</option>
                        <option value="INFO" ${currentOverride === 'INFO' ? 'selected' : ''}>INFO</option>
                        <option value="IGNORE" ${currentOverride === 'IGNORE' ? 'selected' : ''}>IGNORE / EXCLUDE</option>
                    </select>
                    ${actionHtml}
                </div>
            </td>
        `;

        tbody.appendChild(tr);
    });

    // Re-initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Attach event listeners for Confirm buttons
    document.querySelectorAll('.btn-confirm-alarm').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.currentTarget;
            const code = btnEl.getAttribute('data-code');
            const severity = btnEl.getAttribute('data-severity');
            
            // Set the override to the default severity, marking it as confirmed
            currentClassifications[code] = severity;
            
            // Auto save
            await saveClassificationsToServer(currentClassifications);
        });
    });

    // Attach event listeners to select dropdowns to update in-memory currentClassifications
    document.querySelectorAll('.classification-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const code = e.target.getAttribute('data-code');
            const val = e.target.value;
            if (val) {
                currentClassifications[code] = val;
            } else {
                delete currentClassifications[code];
            }
        });
    });
}

// Separate helper to save classifications
async function saveClassificationsToServer(rules) {
    try {
        const res = await fetch('/api/admin/classifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rules)
        });
        if (res.ok) {
            alert("Clasificación guardada y confirmada. Los eventos se han actualizado.");
            adminClassificationsLoaded = false;
            await loadAdminClassifications(true);
            if (typeof refreshDashboard === 'function') {
                refreshDashboard();
            }
        } else {
            alert("Error al guardar la clasificación.");
        }
    } catch (err) {
        console.error("Error saving classifications:", err);
    }
}

// Add event listener for search box
document.getElementById('classification-search')?.addEventListener('input', renderClassificationsTable);

// Save classifications when clicking the save button
document.getElementById('btn-save-classifications')?.addEventListener('click', async () => {
    // Collect all selected values
    const selects = document.querySelectorAll('.classification-select');
    const rules = {};
    selects.forEach(sel => {
        const code = sel.getAttribute('data-code');
        const val = sel.value;
        if (val) {
            rules[code] = val;
        }
    });

    try {
        const res = await fetch('/api/admin/classifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rules)
        });
        if (res.ok) {
            alert("Reglas de clasificación aplicadas correctamente.");
            adminClassificationsLoaded = false;
            await loadAdminClassifications(true);
            if (typeof refreshDashboard === 'function') {
                refreshDashboard();
            }
        } else {
            alert("Error al aplicar las reglas.");
        }
    } catch (err) {
        console.error("Error saving classifications:", err);
    }
});

// Add event listener for register custom catalog form
document.getElementById('form-add-catalog')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('catalog-code').value.trim();
    const label = document.getElementById('catalog-label').value.trim();
    const subsystem = document.getElementById('catalog-subsystem').value;
    const defaultSeverity = document.getElementById('catalog-severity').value;
    const description = document.getElementById('catalog-desc').value.trim();

    if (!code || !label || !subsystem || !defaultSeverity || !description) {
        alert("Por favor, rellene todos los campos.");
        return;
    }

    try {
        const res = await fetch('/api/admin/catalog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code,
                label,
                subsystem,
                defaultSeverity,
                description
            })
        });

        if (res.ok) {
            alert("Nuevo tipo de evento registrado con éxito en el catálogo.");
            // Reset the form
            document.getElementById('form-add-catalog').reset();
            // Reload classifications table
            adminClassificationsLoaded = false;
            await loadAdminClassifications(true);
        } else {
            const errMsg = await res.text();
            alert("Error al registrar evento: " + (errMsg || res.statusText));
        }
    } catch (err) {
        console.error("Error registering custom event catalog:", err);
        alert("Error de red al registrar el evento.");
    }
});


// 5. DICOM Station & Network C-ECHO Ping Management
async function loadDicomStations(force = false) {
    if (!force && dicomStationsLoaded) return;
    const tbody = document.getElementById('dicom-stations-tbody');
    if (!tbody) return;

    try {
        const res = await fetch('/api/dicom/stations');
        if (!res.ok) return;
        const stations = await res.json();
        dicomStationsLoaded = true;

        tbody.innerHTML = "";
        if (stations.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center">No hay estaciones configuradas.</td></tr>`;
            return;
        }

        stations.forEach(s => {
            const tr = document.createElement('tr');
            
            let statusDot = 'unknown';
            let statusLabel = 'Sin verificar';
            if (s.status === 'online') {
                statusDot = 'online';
                statusLabel = 'Activo';
            } else if (s.status === 'offline') {
                statusDot = 'offline';
                statusLabel = 'Desconectado';
            } else if (s.status === 'degraded') {
                statusDot = 'degraded';
                statusLabel = 'Degradado (Rechazo)';
            }

            tr.innerHTML = `
                <td style="font-weight: 600;">${escapeHtml(s.name)}</td>
                <td style="font-family: var(--font-mono); font-size: 0.8rem;">${escapeHtml(s.aeTitle)}</td>
                <td style="font-family: var(--font-mono); font-size: 0.8rem; opacity: 0.8;">${escapeHtml(s.ip)}:${s.port}</td>
                <td>
                    <span class="ping-dot ${statusDot}"></span>
                    <span style="font-size: 0.78rem;">${statusLabel}</span>
                </td>
                <td style="font-family: var(--font-mono); font-size: 0.78rem;">${s.latency}</td>
                <td style="font-size: 0.75rem; opacity: 0.7;">${s.lastChecked}</td>
                <td>
                    <button class="btn glass-btn btn-ping-station" data-id="${s.id}" style="padding: 4px 8px; font-size: 0.72rem; display: flex; align-items: center; gap: 4px;">
                        <i data-lucide="refresh-cw" style="width: 11px; height: 11px;"></i> Probar C-ECHO
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    } catch (err) {
        console.error("Error loading DICOM stations:", err);
    }
}

// Bind DICOM ping individual trigger
document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-ping-station');
    if (btn) {
        e.preventDefault();
        const id = btn.getAttribute('data-id');
        btn.disabled = true;
        btn.innerHTML = `<div class="spinner" style="width:12px; height:12px; border-width:2px; margin:0;"></div> Probando...`;
        
        try {
            const res = await fetch('/api/dicom/ping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                loadDicomStations();
            } else {
                alert("Fallo en la prueba de conectividad.");
                loadDicomStations();
            }
        } catch (err) {
            console.error("Error performing ping:", err);
            loadDicomStations();
        }
    }
});

// Bind DICOM ping all trigger
const btnPingAll = document.getElementById('btn-ping-all');
if (btnPingAll) {
    btnPingAll.addEventListener('click', async () => {
        btnPingAll.disabled = true;
        btnPingAll.innerHTML = `<div class="spinner" style="width:12px; height:12px; border-width:2px; margin:0;"></div> Probando...`;
        
        try {
            const stationsRes = await fetch('/api/dicom/stations');
            if (stationsRes.ok) {
                const stations = await stationsRes.json();
                for (const s of stations) {
                    await fetch('/api/dicom/ping', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: s.id })
                    });
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            btnPingAll.disabled = false;
            btnPingAll.innerHTML = `<i data-lucide="play" style="width:14px; height:14px;"></i> Probar Todos`;
            loadDicomStations();
        }
    });
}

// Bind DICOM station form submission
const dicomForm = document.getElementById('dicom-station-form');
if (dicomForm) {
    dicomForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('dicom-name').value;
        const aeTitle = document.getElementById('dicom-aetitle').value;
        const ip = document.getElementById('dicom-ip').value;
        const port = parseInt(document.getElementById('dicom-port').value);

        try {
            const getRes = await fetch('/api/dicom/stations');
            if (getRes.ok) {
                const stations = await getRes.json();
                const newStation = {
                    id: "station_" + Date.now(),
                    name,
                    aeTitle,
                    ip,
                    port,
                    status: "unknown",
                    latency: "-",
                    lastChecked: "-"
                };
                stations.push(newStation);

                const postRes = await fetch('/api/dicom/stations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(stations)
                });

                if (postRes.ok) {
                    dicomForm.reset();
                    loadDicomStations();
                    alert("Estación DICOM registrada correctamente.");
                } else {
                    alert("Error al guardar la estación.");
                }
            }
        } catch (err) {
            console.error("Error creating station:", err);
        }
    });
}


// 6. Settings Operation Mode Integration
async function loadConfigMode() {
    const selectMode = document.getElementById('setting-opmode');
    const badge = document.getElementById('dashboard-mode-badge');
    const desc = document.getElementById('dashboard-mode-desc');
    const banner = document.getElementById('dashboard-mode-banner');
    const toggleBtn = document.getElementById('btn-toggle-mode-dash');
    const pulseDot = document.getElementById('mode-pulse-dot');
    const pulseRing = document.getElementById('mode-pulse-ring');

    try {
        const res = await fetch('/api/config');
        if (res.ok) {
            const cfg = await res.json();
            const mode = cfg.operationMode || "online";
            
            if (selectMode) selectMode.value = mode;

            if (mode === "service") {
                if (badge) {
                    badge.innerText = "Modo Servicio (Multimarca)";
                    badge.className = "pill pill-warning";
                }
                if (desc) {
                    desc.innerText = "Lectura avanzada activa: logs adicionales de GE y soporte multimarca para Siemens (sysstate.log) y Philips (csdErrorLog).";
                }
                if (banner) {
                    banner.style.borderLeft = "4px solid var(--warning)";
                }
                if (pulseDot) {
                    pulseDot.style.background = "var(--warning)";
                    pulseDot.style.boxShadow = "0 0 8px var(--warning)";
                }
                if (pulseRing) {
                    pulseRing.style.background = "var(--warning)";
                }
                if (toggleBtn) {
                    toggleBtn.innerHTML = `<i data-lucide="sliders" style="width: 14px; height: 14px;"></i> Salir de Modo Servicio`;
                }
            } else {
                if (badge) {
                    badge.innerText = "Modo En Línea";
                    badge.className = "pill pill-info";
                }
                if (desc) {
                    desc.innerText = "Lectura directa en línea en equipos GE (gesys_aurct.log, scanmgr.log, recon.log, dataacq.log).";
                }
                if (banner) {
                    banner.style.borderLeft = "4px solid var(--primary)";
                }
                if (pulseDot) {
                    pulseDot.style.background = "var(--secondary)";
                    pulseDot.style.boxShadow = "0 0 8px var(--secondary)";
                }
                if (pulseRing) {
                    pulseRing.style.background = "var(--secondary)";
                }
                if (toggleBtn) {
                    toggleBtn.innerHTML = `<i data-lucide="sliders" style="width: 14px; height: 14px;"></i> Ingresar Modo Servicio`;
                }
            }
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    } catch (err) {
        console.error(err);
    }
}

// Bind settings form submit
const settingsForm = document.getElementById('settings-form');
if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const selectMode = document.getElementById('setting-opmode');
        const modeVal = selectMode ? selectMode.value : "online";

        // Save mode
        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operationMode: modeVal })
            });
            if (res.ok) {
                alert("Ajustes y Modo de Operación guardados correctamente en el servidor.");
                await loadConfigMode();
                refreshDashboard();
            } else {
                alert("Error al guardar la configuración.");
            }
        } catch (err) {
            console.error(err);
        }
    });
}

// 7. Role Access Control and Health Modeling parameters
function initUserRole() {
    const roleSelect = document.getElementById('user-role-select');
    if (!roleSelect) return;

    // Load initial role
    const activeRole = localStorage.getItem('user-role') || 'operator';
    roleSelect.value = activeRole;
    applyRoleAccessControl(activeRole);

    roleSelect.addEventListener('change', (e) => {
        applyRoleAccessControl(e.target.value);
    });
}

function applyRoleAccessControl(role) {
    localStorage.setItem('user-role', role);

    const adminNav = document.querySelector('.nav-item[data-view="admin-classifications"]');
    const settingsNav = document.querySelector('.nav-item[data-view="settings"]');
    const adminHwPanel = document.getElementById('admin-tube-settings-panel');

    if (role === 'operator') {
        // Hide admin-only features
        if (adminNav) adminNav.style.display = 'none';
        if (settingsNav) settingsNav.style.display = 'none';
        if (adminHwPanel) adminHwPanel.style.display = 'none';

        // If currently viewing admin-classifications or settings, go to dashboard
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) {
            const currentView = activeNav.getAttribute('data-view');
            if (currentView === 'admin-classifications' || currentView === 'settings') {
                const dashNav = document.querySelector('.nav-item[data-view="dashboard"]');
                if (dashNav) {
                    dashNav.click();
                }
            }
        }
    } else {
        // Admin role: show admin views
        if (adminNav) adminNav.style.display = 'flex';
        if (settingsNav) settingsNav.style.display = 'flex';

        // Load config and validator if in admin view
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav) {
            const currentView = activeNav.getAttribute('data-view');
            if (currentView === 'admin-classifications') {
                loadHealthConfig();
            } else if (currentView === 'hardware') {
                loadHardwareAdminParams();
            }
        }
    }
}

async function loadHealthConfig() {
    try {
        const res = await fetch('/api/admin/health-config');
        if (!res.ok) return;
        const cfg = await res.json();

        // Populate fields
        document.getElementById('cfg-mas-capacity').value = cfg.rated_mas_capacity;
        document.getElementById('cfg-k-thermal').value = cfg.k_thermal;
        document.getElementById('cfg-max-thermal').value = cfg.n_max_thermal;
        document.getElementById('cfg-lambda-decay').value = cfg.lambda_decay;

        // Weights
        document.getElementById('cfg-weight-critical').value = cfg.weights.critical;
        document.getElementById('cfg-weight-major').value = cfg.weights.major;
        document.getElementById('cfg-weight-warning').value = cfg.weights.warning;
        document.getElementById('cfg-weight-info').value = cfg.weights.info;

        // Alphas
        document.getElementById('cfg-alpha-tube').value = cfg.alphas.tube;
        document.getElementById('cfg-alpha-generator').value = cfg.alphas.generator;
        document.getElementById('cfg-alpha-das').value = cfg.alphas.das;
        document.getElementById('cfg-alpha-gantry').value = cfg.alphas.gantry;
        document.getElementById('cfg-alpha-cooling').value = cfg.alphas.cooling;
        document.getElementById('cfg-alpha-collimator').value = cfg.alphas.collimator;
        document.getElementById('cfg-alpha-tgp').value = cfg.alphas.tgp;
        document.getElementById('cfg-alpha-obc').value = cfg.alphas.obc;
        document.getElementById('cfg-alpha-rcib').value = cfg.alphas.rcib;
        document.getElementById('cfg-alpha-table').value = cfg.alphas.table;
        document.getElementById('cfg-alpha-console').value = cfg.alphas.console;

        // Draw math validator
        updateMathematicalValidator();

    } catch (err) {
        console.error("Error loading health configuration:", err);
    }
}

async function updateMathematicalValidator() {
    const elThi = document.getElementById('validator-thi-math');
    const elShi = document.getElementById('validator-shi-math');
    const elDhi = document.getElementById('validator-dhi-math');
    if (!elThi || !elShi || !elDhi) return;

    // Get current form values (fallbacks to defaults if empty)
    const ratedCapacity = parseFloat(document.getElementById('cfg-mas-capacity')?.value) || 100000000;
    const kThermal = parseFloat(document.getElementById('cfg-k-thermal')?.value) || 0.05;
    const nMaxThermal = parseFloat(document.getElementById('cfg-max-thermal')?.value) || 300;
    const lambdaDecay = parseFloat(document.getElementById('cfg-lambda-decay')?.value) || 0.01;

    // Weights
    const wCritical = parseFloat(document.getElementById('cfg-weight-critical')?.value) || 0.25;
    const wMajor = parseFloat(document.getElementById('cfg-weight-major')?.value) || 0.18;
    const wWarning = parseFloat(document.getElementById('cfg-weight-warning')?.value) || 0.08;
    const wInfo = parseFloat(document.getElementById('cfg-weight-info')?.value) || 0.01;

    // Alphas
    const alphas = {
        tube: parseFloat(document.getElementById('cfg-alpha-tube')?.value) || 0.35,
        hv_generator: parseFloat(document.getElementById('cfg-alpha-generator')?.value) || 0.20,
        das: parseFloat(document.getElementById('cfg-alpha-das')?.value) || 0.15,
        gantry: parseFloat(document.getElementById('cfg-alpha-gantry')?.value) || 0.12,
        cooling: parseFloat(document.getElementById('cfg-alpha-cooling')?.value) || 0.08,
        collimator: parseFloat(document.getElementById('cfg-alpha-collimator')?.value) || 0.04,
        tgp: parseFloat(document.getElementById('cfg-alpha-tgp')?.value) || 0.02,
        obc: parseFloat(document.getElementById('cfg-alpha-obc')?.value) || 0.02,
        rcib: parseFloat(document.getElementById('cfg-alpha-rcib')?.value) || 0.01,
        table: parseFloat(document.getElementById('cfg-alpha-table')?.value) || 0.01,
        console: parseFloat(document.getElementById('cfg-alpha-console')?.value) || 0.00,
    };

    try {
        const res = await fetch('/api/data');
        if (!res.ok) return;
        const events = await res.json();

        // TUBE mAs & COOLING calculations
        let cumulativeMAs = 7478990; // Default baseline
        let nThermal = 0;
        const now = new Date();

        // Group events by subsystem to compute SHI decay
        const subEvents = {
            tube: [], hv_generator: [], das: [], gantry: [], collimator: [],
            tgp: [], obc: [], rcib: [], table: [], cooling: [], console: []
        };

        events.forEach(ev => {
            const msg = ev.message || "";
            if (ev.subsystem === 'tube' && msg.includes('mAs')) {
                const mAsMatch = msg.match(/([\d,]+)\s*mAs/);
                if (mAsMatch) {
                    const val = parseFloat(mAsMatch[1].replace(/,/g, ''));
                    if (!isNaN(val) && val > cumulativeMAs) {
                        cumulativeMAs = val;
                    }
                }
            }
            if (ev.subsystem === 'cooling' || msg.toLowerCase().includes('cooling') || msg.toLowerCase().includes('thermal')) {
                nThermal++;
            }

            const sub = (ev.subsystem || "console").toLowerCase();
            if (subEvents[sub]) {
                subEvents[sub].push(ev);
            }
        });

        // Compute THI
        const thiBase = Math.max(0, Math.min(1, 1 - (cumulativeMAs / ratedCapacity)));
        const thermalFactor = Math.max(0, 1 - (kThermal * nThermal / nMaxThermal));
        const finalThi = thiBase * thermalFactor * 100;

        elThi.innerHTML = `• mAs Acumulado: ${cumulativeMAs.toLocaleString()} mAs\n` +
                          `• THI_base = 1 - (${cumulativeMAs} / ${ratedCapacity}) = ${thiBase.toFixed(4)}\n` +
                          `• N_thermal (cooling logs): ${nThermal} eventos\n` +
                          `• Factor_térmico = 1 - (${kThermal} * ${nThermal} / ${nMaxThermal}) = ${thermalFactor.toFixed(4)}\n` +
                          `• THI = ${thiBase.toFixed(4)} * ${thermalFactor.toFixed(4)} * 100 = <strong style="color: var(--accent);">${finalThi.toFixed(2)}%</strong>`;

        // Compute SHI for each subsystem
        let shiMathText = "";
        const shiScores = {};
        const subsystems = Object.keys(subEvents);

        subsystems.forEach(sub => {
            let sumDecay = 0;
            
            subEvents[sub].forEach(ev => {
                let w = wInfo;
                if (ev.severity === 'SEVERE_ERROR' || ev.severity === 'CRITICAL') w = wCritical;
                else if (ev.severity === 'MAJOR_ERROR') w = wMajor;
                else if (ev.severity === 'WARNING' || ev.severity === 'WARN_MINOR') w = wWarning;

                const evTime = new Date(ev.timestamp);
                const deltaT = Math.max(0, (now - evTime) / (1000 * 60 * 60)); // hours
                const decay = w * Math.exp(-lambdaDecay * deltaT);
                sumDecay += decay;
            });

            const sumDecayClamped = Math.min(1.0, sumDecay);
            const score = 100 * (1 - sumDecayClamped);
            shiScores[sub] = score;

            if (subEvents[sub].length > 0 || alphas[sub] > 0) {
                shiMathText += `• SHI_${sub.toUpperCase()}: 100 * (1 - Min(1, Σ decay(${subEvents[sub].length} evs))) = <strong style="color: #4cd137;">${score.toFixed(1)}%</strong> (peso α: ${alphas[sub]})\n`;
            }
        });

        elShi.innerHTML = shiMathText || "Sin eventos ni pesos asignados.";

        // Compute DHI
        let sumAlphaSHI = 0;
        let sumAlpha = 0;
        subsystems.forEach(sub => {
            const alpha = alphas[sub];
            sumAlphaSHI += alpha * (shiScores[sub] || 100);
            sumAlpha += alpha;
        });

        const finalDhi = sumAlpha > 0 ? sumAlphaSHI / sumAlpha : 100;
        elDhi.innerHTML = `• Σ (α_s * SHI_s) = ${sumAlphaSHI.toFixed(2)}\n` +
                          `• Σ α_s = ${sumAlpha.toFixed(2)}\n` +
                          `• DHI = ${sumAlphaSHI.toFixed(2)} / ${sumAlpha.toFixed(2)} = <strong style="color: var(--accent); font-size: 1.1rem;">${finalDhi.toFixed(2)}%</strong>`;

    } catch (err) {
        console.error("Error updating mathematical validator sandbox:", err);
    }
}

// Bind live changes to update the math sandbox in real-time
const healthConfigForm = document.getElementById('form-health-config');
if (healthConfigForm) {
    healthConfigForm.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', updateMathematicalValidator);
    });

    healthConfigForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cfg = {
            rated_mas_capacity: parseFloat(document.getElementById('cfg-mas-capacity').value),
            k_thermal: parseFloat(document.getElementById('cfg-k-thermal').value),
            n_max_thermal: parseFloat(document.getElementById('cfg-max-thermal').value),
            lambda_decay: parseFloat(document.getElementById('cfg-lambda-decay').value),
            weights: {
                critical: parseFloat(document.getElementById('cfg-weight-critical').value),
                major: parseFloat(document.getElementById('cfg-weight-major').value),
                warning: parseFloat(document.getElementById('cfg-weight-warning').value),
                info: parseFloat(document.getElementById('cfg-weight-info').value)
            },
            alphas: {
                tube: parseFloat(document.getElementById('cfg-alpha-tube').value),
                hv_generator: parseFloat(document.getElementById('cfg-alpha-generator').value),
                das: parseFloat(document.getElementById('cfg-alpha-das').value),
                gantry: parseFloat(document.getElementById('cfg-alpha-gantry').value),
                cooling: parseFloat(document.getElementById('cfg-alpha-cooling').value),
                collimator: parseFloat(document.getElementById('cfg-alpha-collimator').value),
                tgp: parseFloat(document.getElementById('cfg-alpha-tgp').value),
                obc: parseFloat(document.getElementById('cfg-alpha-obc').value),
                rcib: parseFloat(document.getElementById('cfg-alpha-rcib').value),
                table: parseFloat(document.getElementById('cfg-alpha-table').value),
                console: parseFloat(document.getElementById('cfg-alpha-console').value)
            }
        };

        try {
            const res = await fetch('/api/admin/health-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cfg)
            });

            if (res.ok) {
                alert("Parámetros del Health Modeling Framework guardados correctamente.");
                refreshDashboard();
                updateMathematicalValidator();
            } else {
                alert("Error al guardar la configuración de salud.");
            }
        } catch (err) {
            console.error("Error saving health config:", err);
            alert("Error de red al intentar guardar la configuración.");
        }
    });
}

// 8. Admin Hardware Page wear/capacity parameters
let cachedTubeModels = [];

async function populateTubeModelsDropdown() {
    const select = document.getElementById('admin-hw-tube-model');
    if (!select) return;

    try {
        const res = await fetch('/api/admin/tube-models');
        if (res.ok) {
            const data = await res.json();
            cachedTubeModels = data.tube_models || [];
            
            // Clear existing except first
            while (select.options.length > 1) {
                select.remove(1);
            }

            cachedTubeModels.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.model;
                opt.textContent = `${m.model} (${m.bearing} bearing, ${m.anode_heat_capacity_mhu} MHu)`;
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Error loading tube models taxonomy:", err);
    }
}

async function loadHardwareAdminParams() {
    const activeRole = localStorage.getItem('user-role') || 'operator';
    const adminHwPanel = document.getElementById('admin-tube-settings-panel');
    
    if (activeRole === 'admin') {
        if (adminHwPanel) adminHwPanel.style.display = 'block';
    } else {
        if (adminHwPanel) adminHwPanel.style.display = 'none';
    }

    await populateTubeModelsDropdown();

    try {
        const res = await fetch('/api/admin/health-config');
        if (res.ok) {
            const cfg = await res.json();
            currentHealthConfig = cfg;
            
            // Populate Hardware Admin Form
            const selectModel = document.getElementById('admin-hw-tube-model');
            const inputMas = document.getElementById('admin-hw-mas-capacity');
            const inputTemp = document.getElementById('admin-hw-max-thermal');
            const inputK = document.getElementById('admin-hw-k-thermal');
            const inputRevs = document.getElementById('admin-hw-max-revs');
            
            if (selectModel) selectModel.value = cfg.selected_tube_model || 'auto';
            if (inputMas) inputMas.value = cfg.rated_mas_capacity;
            if (inputTemp) inputTemp.value = cfg.n_max_thermal;
            if (inputK) inputK.value = cfg.k_thermal;
            if (inputRevs) inputRevs.value = parseInt(localStorage.getItem('max-revs-limit')) || 100000;
        }
    } catch (err) {
        console.error("Error loading hardware admin settings:", err);
    }
}

// Bind admin hardware settings change listener
document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'admin-hw-tube-model') {
        const val = e.target.value;
        if (val === 'auto') return;
        const model = cachedTubeModels.find(m => m.model === val);
        if (model) {
            const inputMas = document.getElementById('admin-hw-mas-capacity');
            const inputTemp = document.getElementById('admin-hw-max-thermal');
            if (inputMas) inputMas.value = model.eol_mas_min;
            if (inputTemp) inputTemp.value = Math.round(model.anode_heat_capacity_mhu * 47.6);
        }
    }
});

// Bind admin hardware settings form submit
const adminHwForm = document.getElementById('form-admin-tube-kpi');
if (adminHwForm) {
    adminHwForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectModel = document.getElementById('admin-hw-tube-model');
        const masCapacity = parseFloat(document.getElementById('admin-hw-mas-capacity').value);
        const maxThermal = parseFloat(document.getElementById('admin-hw-max-thermal').value);
        const kThermal = parseFloat(document.getElementById('admin-hw-k-thermal').value);
        const revsVal = parseInt(document.getElementById('admin-hw-max-revs').value);

        if (isNaN(masCapacity) || isNaN(maxThermal) || isNaN(kThermal) || isNaN(revsVal)) {
            alert("Por favor, ingrese valores numéricos válidos.");
            return;
        }

        // Save gantry rotations limit to localStorage
        localStorage.setItem('max-revs-limit', revsVal);

        // Fetch current config first to avoid wiping out other weights/alphas
        try {
            const getRes = await fetch('/api/admin/health-config');
            if (!getRes.ok) throw new Error("Could not fetch current health configuration");
            const currentCfg = await getRes.json();

            // Override tube specific parameters
            currentCfg.rated_mas_capacity = masCapacity;
            currentCfg.n_max_thermal = maxThermal;
            currentCfg.k_thermal = kThermal;
            currentCfg.selected_tube_model = selectModel ? selectModel.value : 'auto';

            // Save back to server
            const postRes = await fetch('/api/admin/health-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentCfg)
            });

            if (postRes.ok) {
                currentHealthConfig = currentCfg;
                alert("Configuración de desgaste y capacidad del tubo guardada correctamente.");
                
                // Refresh dashboard to recalculate values/percents
                refreshDashboard();
            } else {
                alert("Error al guardar la configuración en el servidor.");
            }
        } catch (err) {
            console.error("Error saving hardware admin settings:", err);
            alert("Error al guardar los parámetros de desgaste del tubo.");
        }
    });
}

// ==========================================
// ATREC TMF621 Ticket & Context Menu Engine
// ==========================================

let contextSelectedEvent = null;
let linkedAlarmId = null;

const contextMenu = document.getElementById('alarm-context-menu');
const menuAckAlarm = document.getElementById('menu-ack-alarm');
const menuCreateTicket = document.getElementById('menu-create-ticket');
const menuAssignGroup = document.getElementById('menu-assign-group');
const menuViewDetail = document.getElementById('menu-view-detail');

// Event navigation helper
function showView(viewId) {
    const item = document.querySelector(`.nav-item[data-view="${viewId}"]`);
    if (item) {
        item.click();
    } else {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.view-content').forEach(v => {
            v.classList.remove('active');
            if (v.id === viewId) {
                v.classList.add('active');
            }
        });
    }
}

// Right-click contextmenu event handler
document.addEventListener('contextmenu', function (e) {
    const tr = e.target.closest('tbody tr');
    if (!tr || !tr.eventData) return;

    // Verify it belongs to an alarm/log table
    const tbody = tr.parentNode;
    if (!tbody || (!['mini-logs-tbody', 'full-logs-tbody', 'hardware-tbody', 'dicom-tbody', 'maintenance-tbody'].includes(tbody.id) && !tbody.closest('.history-date-group'))) {
        return;
    }

    e.preventDefault();
    contextSelectedEvent = tr.eventData;

    // Position and show menu
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.style.display = 'block';

    // Update menu items based on ticket status
    if (contextSelectedEvent.ticketId) {
        menuCreateTicket.innerHTML = `<i data-lucide="eye" style="width: 14px; height: 14px; color: var(--success);"></i> Ver Ticket #${contextSelectedEvent.ticketId}`;
        menuAckAlarm.style.display = 'none';
        menuAssignGroup.style.display = 'none';
    } else {
        menuCreateTicket.innerHTML = `<i data-lucide="ticket" style="width: 14px; height: 14px; color: var(--accent);"></i> Crear Ticket ATREC`;
        menuAckAlarm.style.display = 'flex';
        menuAssignGroup.style.display = 'flex';
    }

    if (window.lucide) lucide.createIcons();
});

// Dismiss context menu on click anywhere
document.addEventListener('click', function () {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
});

// Acknowledge Alarm action
if (menuAckAlarm) {
    menuAckAlarm.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!contextSelectedEvent) return;

        try {
            const res = await fetch('/api/admin/classifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tceCode: contextSelectedEvent.tceCode || contextSelectedEvent.process,
                    severity: 'INFORMATIONAL'
                })
            });

            if (res.ok) {
                alert(`Alarma ${contextSelectedEvent.id || 'seleccionada'} reconocida. Nivel de severidad reajustado.`);
                if (typeof loadClassificationData === 'function') {
                    const activeNav = document.querySelector('.nav-item.active');
                    if (activeNav) {
                        const view = activeNav.getAttribute('data-view');
                        if (['hardware', 'dicom', 'alerts', 'maintenance', 'stops'].includes(view)) {
                            loadClassificationData(view, getCurrentQueryParams());
                        }
                    }
                }
                if (typeof loadHistoryData === 'function') loadHistoryData(getCurrentQueryParams());
                if (typeof fetchEvents === 'function') fetchEvents();
            } else {
                alert("Error al reconocer la alarma en el servidor.");
            }
        } catch (err) {
            console.error("Error acknowledging alarm:", err);
        }
    });
}

// Create or View Ticket action
if (menuCreateTicket) {
    menuCreateTicket.addEventListener('click', (e) => {
        e.preventDefault();
        if (!contextSelectedEvent) return;

        if (contextSelectedEvent.ticketId) {
            showView('bitacora');
            openResolutionPanel(contextSelectedEvent.ticketId);
            const ticketEl = document.querySelector(`[onclick="openResolutionPanel('${contextSelectedEvent.ticketId}')"]`);
            if (ticketEl) {
                ticketEl.scrollIntoView({ behavior: 'smooth' });
                ticketEl.style.boxShadow = '0 0 15px var(--accent)';
                setTimeout(() => ticketEl.style.boxShadow = 'none', 3000);
            }
            return;
        }

        linkedAlarmId = contextSelectedEvent.id;
        
        document.getElementById('ticket-title').value = `[${contextSelectedEvent.tceCode || 'MITF'}] Falla en ${contextSelectedEvent.subsystem || 'Subsistema'} - GE CT`;
        
        let sev = 'warning';
        if (contextSelectedEvent.severity === 'CRITICAL' || contextSelectedEvent.severity === 'SEVERE_ERROR') {
            sev = 'critical';
        } else if (contextSelectedEvent.severity === 'WARNING' || contextSelectedEvent.severity === 'MAJOR_ERROR') {
            sev = 'major';
        }
        document.getElementById('ticket-severity').value = sev;
        
        let priority = '3';
        if (sev === 'critical') priority = '1';
        else if (sev === 'major') priority = '2';
        document.getElementById('ticket-priority').value = priority;

        let group = 'grp.noc-transporte';
        const sub = (contextSelectedEvent.subsystem || '').toUpperCase();
        if (sub.includes('COOLING') || sub.includes('POWER') || sub.includes('GANTRY') || sub.includes('TUBE')) {
            group = 'grp.infra-sitio';
        } else if (sub.includes('CONNECTIVITY') || sub.includes('DICOM') || sub.includes('IP') || sub.includes('COMM')) {
            group = 'grp.noc-datos';
        }
        document.getElementById('ticket-group').value = group;

        document.getElementById('ticket-note').value = `Alarma detectada en host ${contextSelectedEvent.host || 'Tomógrafo GE'}. Mensaje original: ${contextSelectedEvent.message}`;
        document.getElementById('ticket-logs').value = contextSelectedEvent.id;

        document.getElementById('lbl-linked-alarm-id').textContent = `#${contextSelectedEvent.id}`;
        document.getElementById('val-canonical-type').textContent = contextSelectedEvent.tceCode || '-';
        document.getElementById('val-network-element').textContent = contextSelectedEvent.host || 'Tomógrafo GE';
        document.getElementById('val-affected-service').textContent = "Servicio de Tomografía (Dosis/Adquisición) / Pacientes Programados";
        document.getElementById('val-alarm-severity').textContent = contextSelectedEvent.severity;
        document.getElementById('atrec-enrichment-panel').classList.remove('hidden');

        showView('bitacora');
        if (window.lucide) lucide.createIcons();
    });
}

// Assign to Group immediately from context menu
if (menuAssignGroup) {
    menuAssignGroup.addEventListener('click', (e) => {
        e.preventDefault();
        if (!contextSelectedEvent) return;

        menuCreateTicket.click();
        const groupEl = document.getElementById('ticket-group');
        if (groupEl) groupEl.focus();
    });
}

// View Detail / Help action
if (menuViewDetail) {
    menuViewDetail.addEventListener('click', (e) => {
        e.preventDefault();
        if (!contextSelectedEvent) return;

        if (contextSelectedEvent.tceCode) {
            openHelpModal(contextSelectedEvent.tceCode);
        } else {
            alert(`Detalle del evento:\nSubsystem: ${contextSelectedEvent.subsystem || '-'}\nProcess: ${contextSelectedEvent.process || '-'}\nMessage: ${contextSelectedEvent.message}`);
        }
    });
}

// Unlink alarm button action
const btnUnlink = document.getElementById('btn-unlink-alarm');
if (btnUnlink) {
    btnUnlink.addEventListener('click', () => {
        linkedAlarmId = null;
        document.getElementById('atrec-enrichment-panel').classList.add('hidden');
        document.getElementById('ticket-logs').value = '';
    });
}

// Proposal Clearing check inside openResolutionPanel
const originalOpenResolutionPanel = openResolutionPanel;
openResolutionPanel = function(ticketId) {
    originalOpenResolutionPanel(ticketId);

    const ticket = allTickets.find(t => t.id === ticketId);
    if (!ticket) return;

    const proposalPanel = document.getElementById('resolution-clearing-proposal');
    const proposalAlarmSpan = document.getElementById('proposal-alarm-id');
    if (!proposalPanel || !proposalAlarmSpan) return;

    proposalPanel.classList.add('hidden');

    if (ticket.status !== 'closed' && ticket.relatedEntity && ticket.relatedEntity.length > 0) {
        const linkedAlarm = ticket.relatedEntity.find(entity => entity.referredType === 'Alarm');
        if (linkedAlarm) {
            const isActive = allEvents.some(ev => ev.id === linkedAlarm.id);
            if (!isActive) {
                proposalAlarmSpan.textContent = linkedAlarm.id;
                proposalPanel.classList.remove('hidden');
                
                const btnProposed = document.getElementById('btn-resolve-proposed');
                if (btnProposed) {
                    btnProposed.onclick = async () => {
                        document.getElementById('diagnosis').value = `[AUTO-CLEARING] Alarma de origen ${linkedAlarm.id} despejada. Reparación validada en remoto.`;
                        document.getElementById('review-general').value = `Comprobación remota: Alarma inactiva. Proponiendo estado Resuelto.`;
                        
                        const container = document.getElementById('tasks-container');
                        if (container) {
                            container.innerHTML = "";
                            addTaskRow("Monitoreo automático de alarmas", "Alarma despejada en consola OSS", true);
                        }
                        
                        const resForm = document.getElementById('resolution-form');
                        if (resForm) {
                            resForm.dispatchEvent(new Event('submit'));
                        }
                    };
                }
            }
        }
    }
};

// Check if alarm already has an open ticket before new ticket submission
const originalTicketFormListener = document.getElementById('ticket-form');
if (originalTicketFormListener) {
    const newForm = originalTicketFormListener.cloneNode(true);
    originalTicketFormListener.parentNode.replaceChild(newForm, originalTicketFormListener);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('ticket-title').value;
        const severity = document.getElementById('ticket-severity').value;
        const engineer = document.getElementById('ticket-engineer').value;
        const priority = document.getElementById('ticket-priority').value;
        const group = document.getElementById('ticket-group').value;
        const operatorNote = document.getElementById('ticket-note').value;
        const relatedLogs = document.getElementById('ticket-logs').value;

        if (linkedAlarmId && allTickets.some(tk => tk.status !== 'closed' && tk.relatedEntity && tk.relatedEntity.some(entity => entity.id === linkedAlarmId))) {
            alert("Esta alarma ya tiene un ticket abierto. No se puede crear un duplicado.");
            return;
        }

        const ticketPayload = {
            name: title,
            severity: severity,
            priority: priority,
            ticketType: "network-fault",
            status: "acknowledged",
            statusChangeReason: "created_from_alarm",
            channel: { name: "manual-noc-console" },
            description: operatorNote || `Falla reportada en logs: ${relatedLogs}`,
            relatedEntity: [],
            relatedParty: [
                { id: engineer, role: "creator" },
                { id: group, role: "assignedGroup" }
            ],
            note: []
        };

        if (operatorNote) {
            ticketPayload.note.push({ text: operatorNote });
        }

        if (relatedLogs) {
            const logsArray = relatedLogs.split(',');
            logsArray.forEach(logId => {
                const trimmed = logId.trim();
                if (trimmed) {
                    ticketPayload.relatedEntity.push({
                        id: trimmed,
                        "@referredType": "Alarm",
                        role: "root-cause"
                    });
                }
            });
        }

        try {
            const res = await fetch('/troubleTicketManagement/v4/troubleTicket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ticketPayload)
            });

            if (res.ok) {
                newForm.reset();
                linkedAlarmId = null;
                document.getElementById('atrec-enrichment-panel').classList.add('hidden');
                loadMaintenanceRecords();
                
                if (typeof fetchEvents === 'function') fetchEvents();

                alert("Ticket abierto y asignado exitosamente en el sistema de gestión ATREC (TMF621).");
            } else {
                alert("Error al abrir el ticket en el servidor ATREC.");
            }
        } catch (err) {
            console.error("Error creating ATREC ticket:", err);
            alert("Error de conexión al guardar el ticket ATREC.");
        }
    });
}
