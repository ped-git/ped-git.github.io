(() => {
    const SECTIONS = [
        'top-roots-section',
        'selective-roots-section',
        'high-kl-roots-section',
        'n2n-roots-section'
    ];
    const CONTENT_SUFFIX = '-content';
    const rootCharts = new Map();
    const chartDataCache = new Map();
    const savedChartWrappers = new Map();

    function normalizeDigits(text) {
        if (!text) return '';
        const withEastern = text.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
        const withArabicIndic = withEastern.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
        return withArabicIndic.replace(/٫/g, '.').replace(/٬/g, '');
    }

    function parseNumericValue(text) {
        if (!text) return 0;
        const normalized = normalizeDigits(text).replace(/[^0-9.\-]/g, '');
        const value = parseFloat(normalized);
        return Number.isFinite(value) ? value : 0;
    }

    function getRootMetric(sectionId, rootDiv) {
        const title = rootDiv.getAttribute('title') || '';
        const normalizedTitle = normalizeDigits(title);
        if (sectionId === 'top-roots-section-content') {
            const countText = rootDiv.querySelector('span:last-child')?.textContent || '';
            return parseNumericValue(countText);
        }
        if (sectionId === 'selective-roots-section-content') {
            const match = normalizedTitle.match(/نسبت:\s*([0-9.]+)/);
            return match ? parseNumericValue(match[1]) : 0;
        }
        if (sectionId === 'high-kl-roots-section-content') {
            const match = normalizedTitle.match(/KL:\s*([0-9.]+)/);
            return match ? parseNumericValue(match[1]) : 0;
        }
        if (sectionId === 'n2n-roots-section-content') {
            const match = normalizedTitle.match(/m:\s*([0-9.]+)/);
            return match ? parseNumericValue(match[1]) : 0;
        }
        return 0;
    }

    function getSelectedRootsWithColors() {
        const result = new Map();
        const selectedSection = document.querySelector('#highlighted-roots-content > div:first-child');
        if (!selectedSection) return result;
        selectedSection.querySelectorAll('[data-root]').forEach((item) => {
            const root = item.getAttribute('data-root');
            const bgColor = item.style.backgroundColor || window.getComputedStyle(item).backgroundColor;
            if (root && bgColor && bgColor !== 'rgb(232, 232, 232)') {
                result.set(root, bgColor);
            }
        });
        return result;
    }

    function saturateColor(color, amount = 80) {
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return color;
        let r = parseInt(match[1], 10);
        let g = parseInt(match[2], 10);
        let b = parseInt(match[3], 10);
        const max = Math.max(r, g, b);
        if (r === max) r = Math.min(255, r + amount * 0.3); else r = Math.max(0, r - amount);
        if (g === max) g = Math.min(255, g + amount * 0.3); else g = Math.max(0, g - amount);
        if (b === max) b = Math.min(255, b + amount * 0.3); else b = Math.max(0, b - amount);
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }

    function darkenColor(color, amount = 50) {
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return color;
        const r = Math.max(0, parseInt(match[1], 10) - amount);
        const g = Math.max(0, parseInt(match[2], 10) - amount);
        const b = Math.max(0, parseInt(match[3], 10) - amount);
        return `rgb(${r}, ${g}, ${b})`;
    }

    const DEFAULT_BAR_COLOR = '#5ba3c0';
    const DEFAULT_BORDER_COLOR = '#3d8aa8';

    function getBarColors(rootKeys, selectedRootsColors) {
        return rootKeys.map((key) => {
            const color = selectedRootsColors.get(key);
            return color ? saturateColor(color) : DEFAULT_BAR_COLOR;
        });
    }

    function getBorderColors(rootKeys, selectedRootsColors) {
        return rootKeys.map((key) => {
            const color = selectedRootsColors.get(key);
            return color ? darkenColor(saturateColor(color), 40) : DEFAULT_BORDER_COLOR;
        });
    }

    function getOrCreateChartTooltip() {
        let tooltipEl = document.getElementById('root-chart-tooltip');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'root-chart-tooltip';
            tooltipEl.style.cssText = 'position:fixed;pointer-events:none;background:rgba(0,0,0,0.85);color:#fff;padding:4px 6px;border-radius:4px;font-size:10px;z-index:10000;max-width:220px;line-height:1.2;';
            document.body.appendChild(tooltipEl);
        }
        return tooltipEl;
    }

    function externalTooltipHandler(context, sectionId, rootKeys, labels) {
        const { chart, tooltip } = context;
        const tooltipEl = getOrCreateChartTooltip();
        if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }
        const index = tooltip.dataPoints?.[0]?.dataIndex ?? 0;
        const title = labels[index] || '';
        const rootKey = rootKeys[index];
        const container = document.getElementById(sectionId);
        const currentItem = rootKey && container ? container.querySelector(`[data-root="${String(rootKey).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`) : null;
        const detail = currentItem?.getAttribute('title') || '';
        const detailFormatted = detail.replace(/\n/g, ' | ');
        tooltipEl.innerHTML = `<div style="font-weight:bold;border-bottom:1px solid #555;padding-bottom:3px;margin-bottom:3px;">${title}</div><div>${detailFormatted}</div>`;
        const canvasRect = chart.canvas.getBoundingClientRect();
        tooltipEl.style.opacity = '1';
        tooltipEl.style.left = `${canvasRect.left + window.scrollX + tooltip.caretX}px`;
        tooltipEl.style.top = `${canvasRect.top + window.scrollY + tooltip.caretY}px`;
    }

    function renderChart(sectionId, labels, rootKeys, values) {
        const container = document.getElementById(sectionId);
        if (!container || !window.Chart) return;
        let wrapper = savedChartWrappers.get(sectionId);
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'chart-wrapper';
            wrapper.style.cssText = 'width:100%;height:65px;position:relative;padding:2px 0;';
            savedChartWrappers.set(sectionId, wrapper);
        }
        if (wrapper.parentElement !== container) container.appendChild(wrapper);

        const existing = rootCharts.get(sectionId);
        if (existing) return;

        let canvas = wrapper.querySelector('.root-chart-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.className = 'root-chart-canvas';
            wrapper.appendChild(canvas);
        }

        const selectedRootsColors = getSelectedRootsWithColors();
        const bgColors = getBarColors(rootKeys, selectedRootsColors);
        const borderColors = getBorderColors(rootKeys, selectedRootsColors);

        const chart = new window.Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: bgColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 3,
                    borderSkipped: false,
                    barThickness: 8,
                    categoryPercentage: 0.75,
                    barPercentage: 0.85
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (ctx) => externalTooltipHandler(ctx, sectionId, rootKeys, labels)
                    }
                },
                scales: {
                    x: { ticks: { font: { size: 8 }, maxRotation: 0, autoSkip: true }, grid: { display: false } },
                    y: { ticks: { display: false }, grid: { display: false } }
                },
                onClick: (event, elementsInfo) => {
                    const index = elementsInfo?.[0]?.index;
                    if (index == null) return;
                    const key = rootKeys[index];
                    const cont = document.getElementById(sectionId);
                    const target = key && cont ? cont.querySelector(`[data-root="${String(key).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`) : null;
                    if (target) target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
            }
        });
        rootCharts.set(sectionId, chart);
    }

    function buildRootChart(sectionId, limits) {
        const limitMap = {
            'top-roots-section-content': 'top_roots',
            'selective-roots-section-content': 'distinctive_roots',
            'high-kl-roots-section-content': 'high_kl_roots',
            'n2n-roots-section-content': 'n2_N_roots'
        };
        const container = document.getElementById(sectionId);
        if (!container) return;
        const roots = Array.from(container.children).filter((child) => child.hasAttribute('data-root'));
        const limitKey = limitMap[sectionId];
        const limit = limitKey ? limits[limitKey] : roots.length;
        const items = roots.slice(0, limit);
        const labels = items.map((item) => item.querySelector('span')?.textContent || '');
        const rootKeys = items.map((item) => item.getAttribute('data-root') || '');
        const values = items.map((item) => getRootMetric(sectionId, item));
        if (items.length === 0) return;
        chartDataCache.set(sectionId, { labels, rootKeys, values });
        renderChart(sectionId, labels, rootKeys, values);
    }

    function updateChartHighlighting() {
        const selectedRootsColors = getSelectedRootsWithColors();
        rootCharts.forEach((chart, sectionId) => {
            const cached = chartDataCache.get(sectionId);
            if (!cached) return;
            chart.data.datasets[0].backgroundColor = getBarColors(cached.rootKeys, selectedRootsColors);
            chart.data.datasets[0].borderColor = getBorderColors(cached.rootKeys, selectedRootsColors);
            chart.update('none');
        });
    }

    function destroyAllCharts() {
        rootCharts.forEach((chart) => chart.destroy());
        rootCharts.clear();
        chartDataCache.clear();
        savedChartWrappers.forEach((wrapper) => { if (wrapper && wrapper.parentElement) wrapper.remove(); });
        savedChartWrappers.clear();
    }

    function loadRootLimits() {
        let limits = {};
        try {
            const stored = localStorage.getItem('desktopRootLimits');
            limits = stored ? JSON.parse(stored) : {};
        } catch {
            limits = {};
        }
        return {
            top_roots: Number.isInteger(limits.top_roots) ? limits.top_roots : 20,
            distinctive_roots: Number.isInteger(limits.distinctive_roots) ? limits.distinctive_roots : 20,
            high_kl_roots: Number.isInteger(limits.high_kl_roots) ? limits.high_kl_roots : 20,
            n2_N_roots: Number.isInteger(limits.n2_N_roots) ? limits.n2_N_roots : 20
        };
    }

    function applyNumbersMode(limits) {
        destroyAllCharts();
        SECTIONS.forEach((sid) => {
            const el = document.getElementById(sid);
            if (el) el.style.display = '';
            const cid = sid + CONTENT_SUFFIX;
            const cont = document.getElementById(cid);
            if (!cont) return;
            const limitMap = {
                'top-roots-section-content': limits.top_roots,
                'selective-roots-section-content': limits.distinctive_roots,
                'high-kl-roots-section-content': limits.high_kl_roots,
                'n2n-roots-section-content': limits.n2_N_roots
            };
            const limit = limitMap[cid] ?? 50;
            const items = Array.from(cont.children).filter((child) => child.hasAttribute('data-root'));
            items.forEach((item, index) => {
                item.style.display = (limit <= 0 || index >= limit) ? 'none' : 'inline-flex';
            });
        });
    }

    function applyHideMode() {
        destroyAllCharts();
        SECTIONS.forEach((sid) => {
            const el = document.getElementById(sid);
            if (el) el.style.display = 'none';
        });
    }

    function applyChartMode(limits) {
        if (!window.Chart) return;
        destroyAllCharts();
        SECTIONS.forEach((sid) => {
            const el = document.getElementById(sid);
            if (el) el.style.display = '';
        });
        const contentIds = SECTIONS.map((s) => s + CONTENT_SUFFIX);
        contentIds.forEach((cid) => {
            const cont = document.getElementById(cid);
            if (!cont) return;
            const items = Array.from(cont.children).filter((child) => child.hasAttribute('data-root'));
            items.forEach((item) => { item.style.display = 'none'; });
            buildRootChart(cid, limits);
        });
    }

    /**
     * @param {'chart'|'numbers'|'off'} mode
     */
    function applyImportantSectionsMode(mode) {
        const limits = loadRootLimits();
        if (mode === 'off') {
            applyHideMode();
        } else         if (mode === 'chart') {
            applyNumbersMode(limits);
            if (window.Chart) {
                applyChartMode(limits);
            }
        } else {
            applyNumbersMode(limits);
        }
    }

    window.SimpleMinimapCharts = {
        applyImportantSectionsMode,
        notifySelectionChanged() {
            if (rootCharts.size) updateChartHighlighting();
        },
        destroyAllCharts
    };
})();
