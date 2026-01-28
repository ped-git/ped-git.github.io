(() => {
    const STORAGE_KEYS = {
        sureNumber: 'desktopSureNumber',
        rootLimits: 'desktopRootLimits',
        rootChart: 'desktopRootChart'
    };

    const DEFAULT_SURE = 36;
    const MAX_SURE = 114;
    const DEFAULT_ROOT_LIMIT = 20;
    const EXPANDED_ROOT_LIMIT = 1000;
    let cachedRootLimits = null;
    const rootCharts = new Map();
    let rootClickTraceActive = false;

    const elements = {
        content: document.getElementById('content'),
        panelsColumn: document.getElementById('panels-column'),
        contentColumn: document.getElementById('desktop-content-wrapper'),
        settingsButton: document.getElementById('settings-button'),
        settingsMenu: document.getElementById('settings-menu'),
        hypothesisToggle: document.getElementById('hypothesis-toggle'),
        sureInput: document.getElementById('sure-number-input'),
        chartToggle: document.getElementById('root-chart-toggle'),
        topLimit: document.getElementById('top-roots-limit'),
        distinctiveLimit: document.getElementById('distinctive-roots-limit'),
        highKlLimit: document.getElementById('high-kl-roots-limit'),
        n2nLimit: document.getElementById('n2n-roots-limit'),
        applyButton: document.getElementById('apply-settings'),
        closeButton: document.getElementById('close-settings')
    };

    function loadRootLimits() {
        let limits = {};
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.rootLimits);
            limits = stored ? JSON.parse(stored) : {};
        } catch {
            limits = {};
        }
        const normalized = {
            top_roots: Number.isInteger(limits.top_roots) ? limits.top_roots : DEFAULT_ROOT_LIMIT,
            distinctive_roots: Number.isInteger(limits.distinctive_roots) ? limits.distinctive_roots : DEFAULT_ROOT_LIMIT,
            high_kl_roots: Number.isInteger(limits.high_kl_roots) ? limits.high_kl_roots : DEFAULT_ROOT_LIMIT,
            n2_N_roots: Number.isInteger(limits.n2_N_roots) ? limits.n2_N_roots : DEFAULT_ROOT_LIMIT
        };
        saveRootLimits(normalized);
        return normalized;
    }

    function saveRootLimits(limits) {
        localStorage.setItem(STORAGE_KEYS.rootLimits, JSON.stringify(limits));
    }

    function loadChartPreference() {
        return localStorage.getItem(STORAGE_KEYS.rootChart) === '1';
    }

    function saveChartPreference(enabled) {
        localStorage.setItem(STORAGE_KEYS.rootChart, enabled ? '1' : '0');
    }

    function setExpandedRootLimits(limits) {
        cachedRootLimits = limits;
        const expanded = {
            top_roots: EXPANDED_ROOT_LIMIT,
            distinctive_roots: EXPANDED_ROOT_LIMIT,
            high_kl_roots: EXPANDED_ROOT_LIMIT,
            n2_N_roots: EXPANDED_ROOT_LIMIT
        };
        saveRootLimits(expanded);
    }

    function restoreRootLimits() {
        if (!cachedRootLimits) {
            cachedRootLimits = loadRootLimits();
        }
        saveRootLimits(cachedRootLimits);
        return cachedRootLimits;
    }

    function getSureNumberFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('s');
        const parsed = parseInt(raw || '', 10);
        if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= MAX_SURE) {
            return parsed;
        }
        return DEFAULT_SURE;
    }

    function clearStoredSureNumber() {
        localStorage.removeItem(STORAGE_KEYS.sureNumber);
    }

    function updateSureParam(number) {
        const url = new URL(window.location.href);
        url.searchParams.set('s', String(number));
        window.history.replaceState({}, '', url.toString());
        return url.toString();
    }

    async function getSuraHref(number) {
        const response = await fetch('list.html', { cache: 'no-cache' });
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = Array.from(doc.querySelectorAll('a[href^="Yasir/"]'));
        const padded = String(number).padStart(3, '0');
        const match = links.find(link => {
            const href = link.getAttribute('href') || '';
            return href.startsWith(`Yasir/${padded}_`) && href.endsWith('_html.html');
        });
        return match ? match.getAttribute('href') : null;
    }

    function injectStylesFromSura(doc, suraHref) {
        const baseUrl = new URL(suraHref, window.location.href);
        const headLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
        headLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            const resolved = new URL(href, baseUrl).href;
            if (document.querySelector(`link[href="${resolved}"]`)) {
                return;
            }
            const newLink = document.createElement('link');
            newLink.rel = 'stylesheet';
            newLink.href = resolved;
            document.head.appendChild(newLink);
        });
    }

    function stripScripts(node) {
        const scripts = node.querySelectorAll('script');
        scripts.forEach(script => script.remove());
    }

    function setSureNumberGlobal(number) {
        window.sureNumber = number;
    }

    function loadMorphologyScript() {
        const existing = document.getElementById('morphology-hover-script');
        if (existing) existing.remove();
        const script = document.createElement('script');
        script.id = 'morphology-hover-script';
        script.src = 'Yasir/morphology-hover.js';
        document.body.appendChild(script);
    }

    function waitForElement(selector, root = document.body) {
        return new Promise(resolve => {
            const existing = root.querySelector(selector);
            if (existing) {
                resolve(existing);
                return;
            }
            const observer = new MutationObserver(() => {
                const found = root.querySelector(selector);
                if (found) {
                    observer.disconnect();
                    resolve(found);
                }
            });
            observer.observe(root, { childList: true, subtree: true });
        });
    }

    function setupScrollProxy() {
        if (window._desktopScrollProxy) return;
        const original = window.scrollTo.bind(window);
        window._desktopScrollProxy = original;
        // Redirect window.scrollTo to content column (for code that uses window.scrollTo)
        window.scrollTo = (optionsOrX, y) => {
            const target = elements.contentColumn;
            if (!target) {
                original(optionsOrX, y);
                return;
            }
            // Just pass through to content column without modification
            if (typeof optionsOrX === 'object') {
                console.log('[charts] window.scrollTo -> content', optionsOrX);
                target.scrollTo(optionsOrX);
            } else {
                console.log('[charts] window.scrollTo -> content', { left: optionsOrX, top: y });
                target.scrollTo(optionsOrX, y);
            }
        };
    }

    function movePanelsIntoLeftColumn() {
        const wrapper = document.getElementById('morphology-combined-panel');
        if (!wrapper) return false;
        wrapper.style.position = 'static';
        wrapper.style.removeProperty('width');
        wrapper.style.removeProperty('max-width');
        wrapper.style.removeProperty('height');
        wrapper.style.removeProperty('max-height');
        wrapper.style.alignSelf = 'stretch';
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '8px';

        const minimap = document.getElementById('morphology-minimap');
        const rootPanel = document.getElementById('highlighted-roots-panel');
        if (minimap) {
            minimap.style.removeProperty('height');
            minimap.style.removeProperty('flex');
            minimap.style.width = '100%';
            minimap.style.maxWidth = '100%';
            minimap.style.minWidth = '0';
        }
        if (rootPanel) {
            rootPanel.style.removeProperty('height');
            rootPanel.style.removeProperty('flex');
            rootPanel.style.width = '100%';
            rootPanel.style.maxWidth = '100%';
            rootPanel.style.minWidth = '0';
        }

        elements.panelsColumn.innerHTML = '';
        if (minimap && rootPanel) {
            wrapper.appendChild(minimap);
            wrapper.appendChild(rootPanel);
        }
        elements.panelsColumn.appendChild(wrapper);
        ensurePanelWidthSync();
        return true;
    }

    function applyPanelWidthStyles() {
        const wrapper = document.getElementById('morphology-combined-panel');
        if (wrapper && elements.panelsColumn.contains(wrapper)) {
            wrapper.style.removeProperty('width');
            wrapper.style.removeProperty('max-width');
            wrapper.style.removeProperty('height');
            wrapper.style.removeProperty('max-height');
            wrapper.style.alignSelf = 'stretch';
        }
        const minimap = document.getElementById('morphology-minimap');
        const rootPanel = document.getElementById('highlighted-roots-panel');
        [minimap, rootPanel].forEach(panel => {
            if (!panel) return;
            panel.style.width = '100%';
            panel.style.maxWidth = '100%';
            panel.style.minWidth = '0';
            panel.style.flex = '1 1 50%';
        });
        updateMinimapContentWidth();
    }

    function updateMinimapContentWidth() {
        const minimap = document.getElementById('morphology-minimap');
        const rootPanel = document.getElementById('highlighted-roots-panel');
        if (!minimap) return;
        const minimapContent = minimap.querySelector('#minimap-content');
        if (!minimapContent) return;
        const reference = rootPanel || minimap;
        const style = window.getComputedStyle(reference);
        const paddingLeft = parseFloat(style.paddingLeft) || 0;
        const paddingRight = parseFloat(style.paddingRight) || 0;
        const availableWidth = Math.max(0, reference.clientWidth - paddingLeft - paddingRight);
        minimapContent.style.width = `${availableWidth}px`;
        minimap.style.width = `${reference.clientWidth}px`;
    }

    function updateMinimap() {
        updateMinimapContentWidth();
        const minimap = document.getElementById('morphology-minimap');
        if (minimap && typeof minimap.updateHighlight === 'function') {
            minimap.updateHighlight();
        }
    }

    // Measure descriptions from root-freq.py
    const MEASURE_DESCRIPTIONS = {
        'top-roots-section': {
            title: 'ریشه‌های پرتکرار',
            description: 'تعداد تکرار هر ریشه در این سوره. ریشه‌هایی که بیشتر در متن ظاهر شده‌اند.',
            formula: 'count = تعداد کل در سوره'
        },
        'selective-roots-section': {
            title: 'ریشه‌های متمایز',
            description: 'ریشه‌هایی که فراوانی نسبی آن‌ها در این سوره بیشتر از سایر سوره‌هاست. نسبت فراوانی هموارشده در سوره به فراوانی در سایر سوره‌ها.',
            formula: 'ratio = (c_sura + α) / (N_sura + αV) ÷ (c_else + α) / (N_else + αV)\nα = 0.5 (هموارسازی)'
        },
        'high-kl-roots-section': {
            title: 'ریشه‌های با KL بالا',
            description: 'سهم هر ریشه در واگرایی کولبک-لایبلر (KL) بین توزیع ریشه‌ها در این سوره و سایر سوره‌ها. مقدار بالاتر یعنی ریشه اطلاعات بیشتری درباره این سوره می‌دهد.',
            formula: 'KL = p × log(p / q)\np = احتمال در سوره، q = احتمال در سایر'
        },
        'n2n-roots-section': {
            title: 'ریشه‌های N²/N',
            description: 'معیاری ترکیبی از تعداد و تمرکز. ریشه‌هایی که هم پرتکرار هستند و هم نسبت به میانگین قرآن در این سوره متمرکزترند.',
            formula: 'm = count × (p / q)\np = فراوانی در سوره، q = فراوانی در کل قرآن'
        }
    };

    // Shared tooltip element for measure info
    let measureInfoTooltip = null;
    
    function getMeasureInfoTooltip() {
        if (!measureInfoTooltip) {
            measureInfoTooltip = document.createElement('div');
            measureInfoTooltip.id = 'measure-info-tooltip';
            measureInfoTooltip.style.cssText = `
                position: fixed;
                background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
                color: #ecf0f1;
                padding: 10px 12px;
                border-radius: 8px;
                font-size: 11px;
                line-height: 1.5;
                z-index: 100000;
                width: 240px;
                box-shadow: 0 6px 20px rgba(0,0,0,0.5);
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s ease, visibility 0.2s ease;
                pointer-events: none;
                direction: rtl;
                text-align: right;
            `;
            document.body.appendChild(measureInfoTooltip);
        }
        return measureInfoTooltip;
    }
    
    function addMeasureInfoIcons() {
        Object.entries(MEASURE_DESCRIPTIONS).forEach(([sectionId, info]) => {
            const section = document.getElementById(sectionId);
            if (!section) return;
            
            // Find the title div (first child div with the title text)
            const titleDiv = section.querySelector('div');
            if (!titleDiv || titleDiv.querySelector('.measure-info-icon')) return;
            
            // Create info icon
            const infoIcon = document.createElement('span');
            infoIcon.className = 'measure-info-icon';
            infoIcon.innerHTML = 'ⓘ';
            infoIcon.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 14px;
                height: 14px;
                margin-right: 5px;
                font-size: 11px;
                color: #6a9fd4;
                cursor: help;
                vertical-align: middle;
                font-style: normal;
                border-radius: 50%;
                transition: all 0.2s ease;
            `;
            
            // Hover events - position tooltip near icon using fixed positioning
            infoIcon.addEventListener('mouseenter', (e) => {
                const tooltip = getMeasureInfoTooltip();
                tooltip.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 4px; font-size: 12px;">${info.title}</div>
                    <div style="margin-bottom: 8px;">${info.description}</div>
                    <div style="font-family: monospace; font-size: 9px; background: rgba(0,0,0,0.3); padding: 4px 6px; border-radius: 4px; white-space: pre-line; line-height: 1.4;">${info.formula}</div>
                `;
                
                const rect = infoIcon.getBoundingClientRect();
                const tooltipWidth = 240;
                
                // Position to the right of icon, or left if not enough space
                let left = rect.right + 8;
                if (left + tooltipWidth > window.innerWidth - 10) {
                    left = rect.left - tooltipWidth - 8;
                }
                // Keep within viewport
                left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));
                
                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${rect.top - 10}px`;
                tooltip.style.opacity = '1';
                tooltip.style.visibility = 'visible';
                
                infoIcon.style.color = '#4ecdc4';
                infoIcon.style.transform = 'scale(1.15)';
            });
            
            infoIcon.addEventListener('mouseleave', () => {
                const tooltip = getMeasureInfoTooltip();
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
                
                infoIcon.style.color = '#6a9fd4';
                infoIcon.style.transform = 'scale(1)';
            });
            
            // Insert at beginning of title div
            titleDiv.insertBefore(infoIcon, titleDiv.firstChild);
        });
    }

    function parseNumericValue(text) {
        if (!text) return 0;
        const normalized = text.replace(/[^0-9.\-]/g, '');
        const value = parseFloat(normalized);
        return Number.isFinite(value) ? value : 0;
    }

    function getRootMetric(sectionId, rootDiv) {
        const title = rootDiv.getAttribute('title') || '';
        if (sectionId === 'top-roots-section-content') {
            const countText = rootDiv.querySelector('span:last-child')?.textContent || '';
            return parseNumericValue(countText);
        }
        if (sectionId === 'selective-roots-section-content') {
            const match = title.match(/نسبت:\s*([0-9.]+)/);
            return match ? parseNumericValue(match[1]) : 0;
        }
        if (sectionId === 'high-kl-roots-section-content') {
            const match = title.match(/KL:\s*([0-9.]+)/);
            return match ? parseNumericValue(match[1]) : 0;
        }
        if (sectionId === 'n2n-roots-section-content') {
            const match = title.match(/m:\s*([0-9.]+)/);
            return match ? parseNumericValue(match[1]) : 0;
        }
        return 0;
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
        
        const roots = Array.from(container.children)
            .filter(child => child.hasAttribute('data-root'));
        const limitKey = limitMap[sectionId];
        const limit = limitKey ? limits[limitKey] : roots.length;
        const items = roots.slice(0, limit);
        const labels = items.map(item => item.querySelector('span')?.textContent || '');
        const rootKeys = items.map(item => item.getAttribute('data-root') || '');
        const values = items.map(item => getRootMetric(sectionId, item));

        if (items.length === 0) return;
        
        // Cache the data for quick restore
        chartDataCache.set(sectionId, { labels, rootKeys, values });
        
        renderChart(sectionId, labels, rootKeys, values);
    }
    
    // Store chart wrappers in a safe place so morphology-hover.js can't destroy them
    const savedChartWrappers = new Map();
    
    // Get currently selected roots with their colors from the selected roots section
    function getSelectedRootsWithColors() {
        const result = new Map(); // root -> color
        const selectedSection = document.querySelector('#highlighted-roots-content > div:first-child');
        if (!selectedSection) return result;
        const items = selectedSection.querySelectorAll('[data-root]');
        items.forEach(item => {
            const root = item.getAttribute('data-root');
            // Get the background color from the element's style
            const bgColor = item.style.backgroundColor || window.getComputedStyle(item).backgroundColor;
            if (root && bgColor && bgColor !== 'rgb(232, 232, 232)') { // Exclude default gray
                result.set(root, bgColor);
            }
        });
        return result;
    }
    
    // Saturate and darken pastel colors to make them more vibrant
    function saturateColor(color, amount = 80) {
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return color;
        let r = parseInt(match[1]);
        let g = parseInt(match[2]);
        let b = parseInt(match[3]);
        
        // Find the dominant channel and increase saturation
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        
        // Make colors more vivid by pulling away from gray
        if (r === max) r = Math.min(255, r + amount * 0.3);
        else r = Math.max(0, r - amount);
        
        if (g === max) g = Math.min(255, g + amount * 0.3);
        else g = Math.max(0, g - amount);
        
        if (b === max) b = Math.min(255, b + amount * 0.3);
        else b = Math.max(0, b - amount);
        
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }
    
    // Darken a color for use as border
    function darkenColor(color, amount = 50) {
        const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (!match) return color;
        const r = Math.max(0, parseInt(match[1]) - amount);
        const g = Math.max(0, parseInt(match[2]) - amount);
        const b = Math.max(0, parseInt(match[3]) - amount);
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    // Default chart color (teal/cyan gradient feel)
    const DEFAULT_BAR_COLOR = '#5ba3c0';
    const DEFAULT_BORDER_COLOR = '#3d8aa8';
    
    // Get bar colors based on selection state
    function getBarColors(rootKeys, selectedRootsColors) {
        return rootKeys.map(key => {
            const color = selectedRootsColors.get(key);
            if (!color) return DEFAULT_BAR_COLOR;
            // Saturate the pastel color to make it more vibrant
            return saturateColor(color);
        });
    }
    
    function getBorderColors(rootKeys, selectedRootsColors) {
        return rootKeys.map(key => {
            const color = selectedRootsColors.get(key);
            if (!color) return DEFAULT_BORDER_COLOR;
            // Saturate then darken for border
            return darkenColor(saturateColor(color), 40);
        });
    }
    
    // Update chart highlighting without full rebuild
    function updateChartHighlighting() {
        const selectedRootsColors = getSelectedRootsWithColors();
        rootCharts.forEach((chart, sectionId) => {
            const cached = chartDataCache.get(sectionId);
            if (!cached) return;
            const bgColors = getBarColors(cached.rootKeys, selectedRootsColors);
            const borderColors = getBorderColors(cached.rootKeys, selectedRootsColors);
            chart.data.datasets[0].backgroundColor = bgColors;
            chart.data.datasets[0].borderColor = borderColors;
            chart.update('none'); // 'none' = no animation
        });
    }
    
    function renderChart(sectionId, labels, rootKeys, values) {
        const container = document.getElementById(sectionId);
        if (!container || !window.Chart) return;
        
        // Check if we have a saved wrapper for this section
        let wrapper = savedChartWrappers.get(sectionId);
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'chart-wrapper';
            wrapper.style.cssText = 'width: 100%; height: 65px; position: relative; padding: 2px 0;';
            savedChartWrappers.set(sectionId, wrapper);
        }
        
        // Ensure wrapper is in the container
        if (wrapper.parentElement !== container) {
            container.appendChild(wrapper);
        }
        
        // Check if chart already exists and has same data
        const existing = rootCharts.get(sectionId);
        if (existing) {
            // Chart exists, just make sure wrapper is visible
            return;
        }
        
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
                    maxBarThickness: 12,
                    categoryPercentage: 0.75,
                    barPercentage: 0.85,
                    hoverBackgroundColor: bgColors.map(c => darkenColor(c, 20)),
                    hoverBorderColor: borderColors.map(c => darkenColor(c, 20)),
                    hoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300,
                    easing: 'easeOutQuart'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: false,
                        external: (context) => externalTooltipHandler(context, sectionId, rootKeys, labels)
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: { size: 8 },
                            maxRotation: 0,
                            autoSkip: true
                        },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { display: false },
                        grid: { display: false }
                    }
                },
                onClick: (event, elementsInfo) => {
                    const index = elementsInfo?.[0]?.index;
                    if (index == null) return;
                    const key = rootKeys[index];
                    const cont = document.getElementById(sectionId);
                    const target = key && cont ? cont.querySelector(`[data-root="${key}"]`) : null;
                    if (target) {
                        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                    }
                }
            }
        });

        rootCharts.set(sectionId, chart);
    }
    
    function restoreChartsFromCache() {
        const sections = [
            'top-roots-section-content',
            'selective-roots-section-content',
            'high-kl-roots-section-content',
            'n2n-roots-section-content'
        ];
        sections.forEach(sectionId => {
            const container = document.getElementById(sectionId);
            if (!container) return;
            
            // Hide root items
            const items = Array.from(container.children).filter(child => child.hasAttribute('data-root'));
            items.forEach(item => { item.style.display = 'none'; });
            
            // Reattach saved wrapper (chart is still intact)
            const wrapper = savedChartWrappers.get(sectionId);
            if (wrapper && wrapper.parentElement !== container) {
                container.appendChild(wrapper);
            }
        });
        
        // Update highlighting for currently selected roots
        updateChartHighlighting();
    }

    let rootPanelObserver = null;
    let rootPanelUpdating = false;

    function observeRootSectionsOnce(enabled, limits) {
        if (window._rootSectionObserverActive) return;
        window._rootSectionObserverActive = true;
        const observer = new MutationObserver(() => {
            const allPresent = [
                'top-roots-section-content',
                'selective-roots-section-content',
                'high-kl-roots-section-content',
                'n2n-roots-section-content'
            ].every(id => document.getElementById(id));
            if (!allPresent) return;
            observer.disconnect();
            window._rootSectionObserverActive = false;
            updateRootChartMode(enabled, limits);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Track the root panel fingerprint to avoid unnecessary refreshes
    let lastRootFingerprint = '';
    
    function getRootPanelFingerprint() {
        // Track ALL roots in the entire highlighted-roots-content panel
        // This includes selected roots + all statistical sections
        const content = document.getElementById('highlighted-roots-content');
        if (!content) {
            console.log('[charts] fingerprint: content not found');
            return 'NO_CONTENT';
        }
        const items = content.querySelectorAll('[data-root]');
        const roots = Array.from(items).map(item => item.getAttribute('data-root'));
        const fp = roots.join(',');
        console.log('[charts] fingerprint: roots count', roots.length, 'sample:', fp.slice(0, 80));
        return fp;
    }
    
    function setupRootPanelRefreshObserver() {
        if (rootPanelObserver) return;
        
        rootPanelObserver = new MutationObserver((mutations) => {
            if (rootPanelUpdating) {
                console.log('[charts] observer: rootPanelUpdating true, skipping');
                return;
            }
            
            // Check if root items were added (directly or nested inside added containers)
            let hasRootItems = false;
            let addedInfo = [];
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    // Check if the node itself has data-root
                    if (node.hasAttribute && node.hasAttribute('data-root')) {
                        hasRootItems = true;
                        addedInfo.push('direct:' + node.getAttribute('data-root'));
                    }
                    // Check if the node contains elements with data-root
                    if (node.querySelectorAll) {
                        const nested = node.querySelectorAll('[data-root]');
                        if (nested.length > 0) {
                            hasRootItems = true;
                            addedInfo.push('nested:' + nested.length);
                        }
                    }
                }
            }
            
            console.log('[charts] observer mutations:', { count: mutations.length, hasRootItems, addedInfo: addedInfo.slice(0, 5) });
            
            if (!hasRootItems) return;
            
            // Always add info icons when panel is rebuilt
            addMeasureInfoIcons();
            
            const chartPref = loadChartPreference();
            if (!chartPref) {
                console.log('[charts] observer: chartPref false, skipping chart logic');
                return;
            }
            
            // Check if the root panel actually changed (different roots)
            const newFingerprint = getRootPanelFingerprint();
            const fingerprintChanged = newFingerprint !== lastRootFingerprint;
            
            // If fingerprint is same, just reattach charts (no rebuild needed)
            if (!fingerprintChanged) {
                if (savedChartWrappers.size > 0) {
                    restoreChartsFromCache();
                }
                return;
            }
            
            lastRootFingerprint = newFingerprint;
            
            const content = document.getElementById('highlighted-roots-content');
            if (!content) {
                console.log('[charts] observer: content not found');
                return;
            }
            
            rootPanelUpdating = true;
            rootPanelObserver.disconnect();
            const limits = loadRootLimits();
            console.log('[charts] observer: calling updateRootPanelFromLimits');
            updateRootPanelFromLimits(limits, false);
            console.log('[charts] observer: calling updateRootChartMode(true)');
            updateRootChartMode(true, limits);
            console.log('[charts] observer: done refreshing');
            // Always re-observe document.body to catch full panel replacements
            rootPanelObserver.observe(document.body, { childList: true, subtree: true });
            rootPanelUpdating = false;
        });
        
        // Start observing document.body to catch panel rebuilds
        rootPanelObserver.observe(document.body, { childList: true, subtree: true });
        console.log('[charts] observer: started on document.body');
        
        // Debug: track clicks on content area
        const contentArea = document.getElementById('content');
        if (contentArea) {
            contentArea.addEventListener('click', (e) => {
                const word = e.target.closest('.morph-word');
                if (word) {
                    console.log('[charts] content word click:', {
                        word: word.textContent?.slice(0, 20),
                        root: word.getAttribute('data-root'),
                        ayah: word.getAttribute('data-ayah')
                    });
                }
            }, true);
        }
    }

    function getSelectedWordSnapshot() {
        const el = document.querySelector('.root-selected-word');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const scrollTop = elements.contentColumn ? elements.contentColumn.scrollTop : window.scrollY;
        return {
            ayah: el.getAttribute('data-ayah'),
            wordIndex: el.getAttribute('data-word-index'),
            rectTop: Math.round(rect.top),
            rectBottom: Math.round(rect.bottom),
            scrollTop: Math.round(scrollTop)
        };
    }

    function getHighlightedWordOrderByColor(color) {
        if (!color) return [];
        const words = Array.from(document.querySelectorAll('.morph-word.root-highlighted'));
        const matches = words.filter(word => {
            const bg = window.getComputedStyle(word).backgroundColor;
            return bg === color;
        });
        return matches
            .map(word => ({
                ayah: Number(word.getAttribute('data-ayah')),
                wordIndex: Number(word.getAttribute('data-word-index'))
            }))
            .filter(item => Number.isFinite(item.ayah) && Number.isFinite(item.wordIndex))
            .sort((a, b) => (a.ayah - b.ayah) || (a.wordIndex - b.wordIndex));
    }

    // Cache chart data so we can quickly restore after morphology-hover.js destroys them
    const chartDataCache = new Map();
    
    function updateRootChartMode(enabled, limits) {
        if (enabled && !isChartReady()) {
            return;
        }
        const sections = [
            'top-roots-section-content',
            'selective-roots-section-content',
            'high-kl-roots-section-content',
            'n2n-roots-section-content'
        ];
        
        sections.forEach(sectionId => {
            const container = document.getElementById(sectionId);
            if (!container) {
                if (enabled) {
                    observeRootSectionsOnce(enabled, limits);
                }
                return;
            }
            const items = Array.from(container.children).filter(child => child.hasAttribute('data-root'));
            
            // Cleanup: destroy existing chart
            const existingChart = rootCharts.get(sectionId);
            if (existingChart) {
                existingChart.destroy();
                rootCharts.delete(sectionId);
            }
            
            // Remove existing chart wrapper
            const existingWrapper = container.querySelector('.chart-wrapper');
            if (existingWrapper) existingWrapper.remove();
            
            if (enabled) {
                buildRootChart(sectionId, limits);
                items.forEach(item => {
                    item.style.display = 'none';
                });
            } else {
                chartDataCache.delete(sectionId);
                savedChartWrappers.delete(sectionId);
                // Respect limits when showing items (not charts)
                const limitMap = {
                    'top-roots-section-content': limits.top_roots,
                    'selective-roots-section-content': limits.distinctive_roots,
                    'high-kl-roots-section-content': limits.high_kl_roots,
                    'n2n-roots-section-content': limits.n2_N_roots
                };
                const limit = limitMap[sectionId] ?? items.length;
                items.forEach((item, index) => {
                    item.style.display = (limit <= 0 || index >= limit) ? 'none' : 'inline-flex';
                });
            }
        });
        
        // Remove stale overlay if it exists
        const overlay = document.getElementById('root-charts-overlay');
        if (overlay) overlay.remove();
    }

    function getOrCreateChartTooltip(chart) {
        let tooltipEl = document.getElementById('root-chart-tooltip');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.id = 'root-chart-tooltip';
            tooltipEl.style.cssText = `
                position: absolute;
                pointer-events: none;
                background: rgba(0, 0, 0, 0.85);
                color: white;
                padding: 4px 6px;
                border-radius: 4px;
                font-size: 10px;
                z-index: 10000;
                max-width: 220px;
                line-height: 1.2;
            `;
            document.body.appendChild(tooltipEl);
        }
        return tooltipEl;
    }

    function externalTooltipHandler(context, sectionId, rootKeys, labels) {
        const { chart, tooltip } = context;
        const tooltipEl = getOrCreateChartTooltip(chart);

        if (tooltip.opacity === 0) {
            tooltipEl.style.opacity = '0';
            return;
        }

        const index = tooltip.dataPoints?.[0]?.dataIndex ?? 0;
        const title = labels[index] || '';
        const rootKey = rootKeys[index];
        const container = document.getElementById(sectionId);
        const currentItem = rootKey && container ? container.querySelector(`[data-root="${rootKey}"]`) : null;
        const detail = currentItem?.getAttribute('title') || '';
        tooltipEl.innerHTML = `<div>${title}</div><div style="margin-top:2px;">${detail}</div>`;

        const canvasRect = chart.canvas.getBoundingClientRect();
        const pageX = canvasRect.left + window.scrollX;
        const pageY = canvasRect.top + window.scrollY;
        tooltipEl.style.opacity = '1';
        tooltipEl.style.left = `${pageX + tooltip.caretX}px`;
        tooltipEl.style.top = `${pageY + tooltip.caretY}px`;
    }

    function isChartReady() {
        return !!window.Chart;
    }

    function updateRootPanelFromLimits(limits, chartEnabled = loadChartPreference()) {
        const sectionConfigs = [
            { id: 'top-roots-section-content', limit: limits.top_roots },
            { id: 'selective-roots-section-content', limit: limits.distinctive_roots },
            { id: 'high-kl-roots-section-content', limit: limits.high_kl_roots },
            { id: 'n2n-roots-section-content', limit: limits.n2_N_roots }
        ];

        console.log('[charts] updateRootPanelFromLimits', { chartEnabled, limits });
        sectionConfigs.forEach(({ id, limit }) => {
            const container = document.getElementById(id);
            if (!container) return;
            const items = Array.from(container.children).filter(child => child.hasAttribute('data-root'));
            items.forEach((item, index) => {
                item.style.display = (limit <= 0 || index >= limit) ? 'none' : 'inline-flex';
            });
        });
        if (chartEnabled) {
            updateRootChartMode(true, limits);
        }
    }

    function ensurePanelWidthSync() {
        if (window._panelWidthSyncSetup) return;
        window._panelWidthSyncSetup = true;
        applyPanelWidthStyles();

        window.addEventListener('resize', () => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    applyPanelWidthStyles();
                });
            });
        }, { passive: true });

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type !== 'childList') continue;
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    if (node.id === 'morphology-minimap' ||
                        node.id === 'highlighted-roots-panel' ||
                        node.id === 'morphology-combined-panel' ||
                        node.querySelector?.('#morphology-minimap, #highlighted-roots-panel, #morphology-combined-panel')) {
                        applyPanelWidthStyles();
                        return;
                    }
                }
            }
        });
        observer.observe(document.body, {
            subtree: true,
            childList: true
        });
    }

    function restorePanelsPlaceholder() {
        elements.panelsColumn.innerHTML = `
            <div id="panels-placeholder">پنل اول</div>
            <div id="panel-placeholder-bottom">پنل دوم</div>
        `;
    }

    function attachSettingsToHeader() {
        const header = elements.content.querySelector('#header') || elements.content.querySelector('div');
        if (!header) return false;
        header.style.position = 'relative';
        let wrapper = header.querySelector('.settings-wrapper');
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'settings-wrapper';
            header.appendChild(wrapper);
        }
        wrapper.appendChild(elements.settingsButton);
        wrapper.appendChild(elements.settingsMenu);
        return true;
    }

    function setupHypothesisToggle() {
        if (!elements.hypothesisToggle) return;
        elements.hypothesisToggle.addEventListener('change', () => {
            const enabled = elements.hypothesisToggle.checked;
            console.log('[hypothesis] toggle', { enabled });
            if (typeof setHypothesisDocumentInteractivity === 'function') {
                setHypothesisDocumentInteractivity(enabled);
            }
        });
    }

    function setupDesktopMinimapSync() {
        const minimap = document.getElementById('morphology-minimap');
        const visibleHighlight = document.getElementById('minimap-visible-highlight');
        if (!minimap || !visibleHighlight) return false;

        // let lastDebug = 0;
        const update = () => {
            const minTop = minimap._minTop;
            const contentHeight = minimap._contentHeight;
            const contentWidth = minimap._contentWidth;
            const extraSpace = minimap._extraSpace || 5;
            const scaleFactor = minimap._scaleFactor || 1;
            if (minTop == null || !contentHeight || !contentWidth) return;

            const wrapper = elements.contentColumn;
            if (!wrapper) return;
            const firstWord = elements.content.querySelector('.morph-word');
            if (!firstWord) return;

            const wrapperRect = wrapper.getBoundingClientRect();
            const firstWordRect = firstWord.getBoundingClientRect();
            const minTopLive = firstWordRect.top + wrapper.scrollTop;
            const minTopUsed = Number.isFinite(minTopLive) ? minTopLive : minTop;
            const scrollTop = wrapper.scrollTop;
            const viewportHeight = wrapper.clientHeight || window.innerHeight;
            const viewportBottom = scrollTop + viewportHeight;
            const scaledHeight = contentHeight * scaleFactor;
            const scaledWidth = contentWidth * scaleFactor;

            const visibleTop = Math.max(0, (scrollTop - minTopUsed) * scaleFactor);
            const visibleBottom = Math.min(scaledHeight, (viewportBottom - minTopUsed) * scaleFactor);
            const visibleHeight = Math.max(10, visibleBottom - visibleTop);
            const minimapContent = minimap.querySelector('#minimap-content');
            const minimapRect = minimap.getBoundingClientRect();
            const contentRect = minimapContent ? minimapContent.getBoundingClientRect() : minimapRect;
            const contentLeft = Math.max(0, contentRect.left - minimapRect.left);
            const contentWidthPx = Math.max(0, contentRect.width);
            const visibleWidth = contentWidthPx > 0 ? contentWidthPx : Math.max(0, scaledWidth - extraSpace);

            visibleHighlight.style.top = `${visibleTop}px`;
            visibleHighlight.style.left = `${contentLeft}px`;
            visibleHighlight.style.width = `${visibleWidth}px`;
            visibleHighlight.style.height = `${visibleHeight}px`;

            // const now = Date.now();
            // if (now - lastDebug > 1000) {
            //     lastDebug = now;
            //     console.log('[desktop minimap]', {
            //         minTop,
            //         scaleFactor,
            //         wrapperScrollTop: wrapper.scrollTop,
            //         minTopLive,
            //         minTopUsed,
            //         scrollTop,
            //         viewportHeight,
            //         visibleTop,
            //         visibleHeight,
            //         contentLeft,
            //         contentWidthPx,
            //         scaledWidth,
            //         scaledHeight
            //     });
            // }
        };

        elements.contentColumn.addEventListener('scroll', () => {
            window.requestAnimationFrame(update);
        }, { passive: true });
        window.addEventListener('resize', update, { passive: true });
        update();
        return true;
    }

    async function preparePanelsAndMinimap() {
        await Promise.all([
            waitForElement('#morphology-combined-panel'),
            waitForElement('#morphology-minimap'),
            waitForElement('#highlighted-roots-panel')
        ]);
        movePanelsIntoLeftColumn();
        setupDesktopMinimapSync();
        const limits = restoreRootLimits();
        updateRootPanelFromLimits(limits);
        addMeasureInfoIcons();
        setupRootPanelRefreshObserver();
        const chartEnabled = loadChartPreference();
        updateRootChartMode(chartEnabled, limits);
        // Set initial fingerprint to avoid unnecessary refreshes
        lastRootFingerprint = getRootPanelFingerprint();
        updateMinimap();
    }

    async function loadSuraContent(number) {
        const href = await getSuraHref(number);
        if (!href) {
            elements.content.innerHTML = '<p>سوره یافت نشد.</p>';
            return;
        }

        const response = await fetch(href, { cache: 'no-cache' });
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        injectStylesFromSura(doc, href);

        const body = doc.body;
        stripScripts(body);
        elements.content.innerHTML = body.innerHTML;
        restorePanelsPlaceholder();

        setSureNumberGlobal(number);
        const limits = loadRootLimits();
        setExpandedRootLimits(limits);
        loadMorphologyScript();
        setupScrollProxy();
        attachSettingsToHeader();
        setupHypothesisToggle();
        overrideSuraNavigation();
        preparePanelsAndMinimap();
    }   

    // Sura names in Arabic
    const SURA_NAMES = {
        1: 'فاتحه', 2: 'بقره', 3: 'آل عمران', 4: 'نساء', 5: 'مائده',
        6: 'انعام', 7: 'اعراف', 8: 'انفال', 9: 'توبه', 10: 'یونس',
        11: 'هود', 12: 'یوسف', 13: 'رعد', 14: 'ابراهیم', 15: 'حجر',
        16: 'نحل', 17: 'اسراء', 18: 'کهف', 19: 'مریم', 20: 'طه',
        21: 'انبیاء', 22: 'حج', 23: 'مؤمنون', 24: 'نور', 25: 'فرقان',
        26: 'شعراء', 27: 'نمل', 28: 'قصص', 29: 'عنکبوت', 30: 'روم',
        31: 'لقمان', 32: 'سجده', 33: 'احزاب', 34: 'سبأ', 35: 'فاطر',
        36: 'یس', 37: 'صافات', 38: 'ص', 39: 'زمر', 40: 'غافر',
        41: 'فصلت', 42: 'شوری', 43: 'زخرف', 44: 'دخان', 45: 'جاثیه',
        46: 'احقاف', 47: 'محمد', 48: 'فتح', 49: 'حجرات', 50: 'ق',
        51: 'ذاریات', 52: 'طور', 53: 'نجم', 54: 'قمر', 55: 'رحمن',
        56: 'واقعه', 57: 'حدید', 58: 'مجادله', 59: 'حشر', 60: 'ممتحنه',
        61: 'صف', 62: 'جمعه', 63: 'منافقون', 64: 'تغابن', 65: 'طلاق',
        66: 'تحریم', 67: 'ملک', 68: 'قلم', 69: 'حاقه', 70: 'معارج',
        71: 'نوح', 72: 'جن', 73: 'مزمل', 74: 'مدثر', 75: 'قیامه',
        76: 'انسان', 77: 'مرسلات', 78: 'نبأ', 79: 'نازعات', 80: 'عبس',
        81: 'تکویر', 82: 'انفطار', 83: 'مطففین', 84: 'انشقاق', 85: 'بروج',
        86: 'طارق', 87: 'اعلی', 88: 'غاشیه', 89: 'فجر', 90: 'بلد',
        91: 'شمس', 92: 'لیل', 93: 'ضحی', 94: 'شرح', 95: 'تین',
        96: 'علق', 97: 'قدر', 98: 'بینه', 99: 'زلزله', 100: 'عادیات',
        101: 'قارعه', 102: 'تکاثر', 103: 'عصر', 104: 'همزه', 105: 'فیل',
        106: 'قریش', 107: 'ماعون', 108: 'کوثر', 109: 'کافرون', 110: 'نصر',
        111: 'مسد', 112: 'اخلاص', 113: 'فلق', 114: 'ناس'
    };

    // Sura verse counts
    const SURA_AYAT = {
        1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
        11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135,
        21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60,
        31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182, 38: 88, 39: 75, 40: 85,
        41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
        51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24, 60: 13,
        61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
        71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42,
        81: 29, 82: 19, 83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20,
        91: 15, 92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
        101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
        111: 5, 112: 4, 113: 5, 114: 6
    };

    let customSuraOverlay = null;
    let currentSuraView = 'grid'; // 'grid' or 'timeline'
    let timelineTooltip = null;

    function getTimelineTooltip() {
        if (!timelineTooltip) {
            timelineTooltip = document.createElement('div');
            timelineTooltip.id = 'timeline-global-tooltip';
            
            const nameEl = document.createElement('div');
            nameEl.className = 'tooltip-name';
            
            const infoEl = document.createElement('div');
            infoEl.className = 'tooltip-info';
            
            timelineTooltip.appendChild(nameEl);
            timelineTooltip.appendChild(infoEl);
            document.body.appendChild(timelineTooltip);
        }
        return timelineTooltip;
    }

    function showTimelineTooltip(item) {
        const tooltip = getTimelineTooltip();
        const suraNum = item.getAttribute('data-sura');
        const suraName = item.getAttribute('data-name') || `سوره ${suraNum}`;
        const ayat = item.getAttribute('data-ayat') || '?';

        tooltip.querySelector('.tooltip-name').textContent = suraName;
        tooltip.querySelector('.tooltip-info').textContent = `سوره ${suraNum} • ${ayat} آیه`;

        const rect = item.getBoundingClientRect();
        const tooltipWidth = 160;
        
        let left = rect.left + rect.width / 2 - tooltipWidth / 2;
        left = Math.max(10, Math.min(left, window.innerWidth - tooltipWidth - 10));
        
        const top = rect.top - 10;

        tooltip.style.left = `${left}px`;
        tooltip.style.bottom = `${window.innerHeight - top}px`;
        tooltip.style.top = 'auto';
        tooltip.classList.add('visible');
    }

    function hideTimelineTooltip() {
        const tooltip = getTimelineTooltip();
        tooltip.classList.remove('visible');
    }

    function createCustomSuraMenu() {
        if (customSuraOverlay) return customSuraOverlay;

        const currentSura = getSureNumberFromUrl();

        // Create overlay
        customSuraOverlay = document.createElement('div');
        customSuraOverlay.id = 'custom-sura-overlay';

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'custom-sura-modal';

        // Header
        const header = document.createElement('div');
        header.className = 'sura-modal-header';

        const title = document.createElement('h2');
        title.className = 'sura-modal-title';
        title.textContent = 'انتخاب سوره';

        const searchContainer = document.createElement('div');
        searchContainer.className = 'sura-search-container';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'sura-search-input';
        searchInput.placeholder = 'جستجو...';
        searchInput.addEventListener('input', () => filterSuras(searchInput.value));

        const searchIcon = document.createElement('span');
        searchIcon.className = 'sura-search-icon';
        searchIcon.textContent = '🔍';

        searchContainer.appendChild(searchInput);
        searchContainer.appendChild(searchIcon);

        // Header controls (view toggles + close)
        const headerControls = document.createElement('div');
        headerControls.className = 'header-controls';

        // Grid view button
        const gridBtn = document.createElement('button');
        gridBtn.className = 'view-toggle-btn active';
        gridBtn.id = 'grid-view-btn';
        gridBtn.innerHTML = '▦ شبکه';
        gridBtn.addEventListener('click', () => setSuraView('grid'));

        // Timeline view button
        const timelineBtn = document.createElement('button');
        timelineBtn.className = 'view-toggle-btn';
        timelineBtn.id = 'timeline-view-btn';
        timelineBtn.innerHTML = '━ خطی';
        timelineBtn.addEventListener('click', () => setSuraView('timeline'));

        const closeBtn = document.createElement('button');
        closeBtn.className = 'sura-close-btn';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', hideCustomSuraMenu);

        headerControls.appendChild(gridBtn);
        headerControls.appendChild(timelineBtn);
        headerControls.appendChild(closeBtn);

        header.appendChild(title);
        header.appendChild(searchContainer);
        header.appendChild(headerControls);

        // Body
        const body = document.createElement('div');
        body.className = 'sura-modal-body';

        // Grid view
        const grid = document.createElement('div');
        grid.className = 'sura-grid';
        grid.id = 'sura-grid';

        // Timeline view
        const timeline = document.createElement('div');
        timeline.className = 'sura-timeline';
        timeline.id = 'sura-timeline';

        const timelineTrack = document.createElement('div');
        timelineTrack.className = 'timeline-track';

        const timelineLine = document.createElement('div');
        timelineLine.className = 'timeline-line';

        const timelineScroll = document.createElement('div');
        timelineScroll.className = 'timeline-scroll';
        timelineScroll.id = 'timeline-scroll';

        timelineTrack.appendChild(timelineLine);
        timelineTrack.appendChild(timelineScroll);
        timeline.appendChild(timelineTrack);

        // Create sura items for both views
        for (let i = 1; i <= 114; i++) {
            // Grid card
            const card = document.createElement('div');
            card.className = 'sura-card' + (i === currentSura ? ' current' : '');
            card.setAttribute('data-sura', i);
            card.setAttribute('data-name', SURA_NAMES[i] || '');

            const number = document.createElement('div');
            number.className = 'sura-number';
            number.textContent = i;

            const name = document.createElement('div');
            name.className = 'sura-name';
            name.textContent = SURA_NAMES[i] || `سوره ${i}`;

            const info = document.createElement('div');
            info.className = 'sura-info';
            info.textContent = `${SURA_AYAT[i] || '?'} آیه`;

            card.appendChild(number);
            card.appendChild(name);
            card.appendChild(info);

            card.addEventListener('click', () => {
                const nextUrl = updateSureParam(i);
                window.location.href = nextUrl;
            });

            grid.appendChild(card);

            // Timeline item
            const timelineItem = document.createElement('div');
            timelineItem.className = 'timeline-item' + (i === currentSura ? ' current' : '');
            timelineItem.setAttribute('data-sura', i);
            timelineItem.setAttribute('data-name', SURA_NAMES[i] || '');
            timelineItem.setAttribute('data-ayat', SURA_AYAT[i] || '?');

            const dot = document.createElement('div');
            dot.className = 'timeline-dot';

            const tNumber = document.createElement('div');
            tNumber.className = 'timeline-number';
            tNumber.textContent = i;

            const tName = document.createElement('div');
            tName.className = 'timeline-name';
            tName.textContent = SURA_NAMES[i] || `سوره ${i}`;

            timelineItem.appendChild(dot);
            timelineItem.appendChild(tNumber);
            timelineItem.appendChild(tName);

            // Hover events for global tooltip
            timelineItem.addEventListener('mouseenter', (e) => {
                showTimelineTooltip(timelineItem);
            });
            timelineItem.addEventListener('mouseleave', () => {
                hideTimelineTooltip();
            });

            timelineItem.addEventListener('click', () => {
                const nextUrl = updateSureParam(i);
                window.location.href = nextUrl;
            });

            timelineScroll.appendChild(timelineItem);
        }

        body.appendChild(grid);
        body.appendChild(timeline);
        modal.appendChild(header);
        modal.appendChild(body);
        customSuraOverlay.appendChild(modal);

        // Close on overlay click
        customSuraOverlay.addEventListener('click', (e) => {
            if (e.target === customSuraOverlay) {
                hideCustomSuraMenu();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && customSuraOverlay.classList.contains('visible')) {
                hideCustomSuraMenu();
            }
        });

        document.body.appendChild(customSuraOverlay);
        return customSuraOverlay;
    }

    function filterSuras(query) {
        const normalizedQuery = query.trim().toLowerCase();
        
        // Filter grid cards
        const grid = document.getElementById('sura-grid');
        if (grid) {
            const cards = grid.querySelectorAll('.sura-card');
            cards.forEach(card => {
                const suraNum = card.getAttribute('data-sura');
                const suraName = card.getAttribute('data-name') || '';
                const matches = 
                    suraNum.includes(normalizedQuery) ||
                    suraName.includes(normalizedQuery) ||
                    normalizedQuery === '';
                card.classList.toggle('hidden', !matches);
            });
        }

        // Filter timeline items
        const timelineScroll = document.getElementById('timeline-scroll');
        if (timelineScroll) {
            const items = timelineScroll.querySelectorAll('.timeline-item');
            items.forEach(item => {
                const suraNum = item.getAttribute('data-sura');
                const suraName = item.getAttribute('data-name') || '';
                const matches = 
                    suraNum.includes(normalizedQuery) ||
                    suraName.includes(normalizedQuery) ||
                    normalizedQuery === '';
                item.classList.toggle('hidden', !matches);
            });
        }
    }

    function setSuraView(view) {
        currentSuraView = view;
        const modal = document.getElementById('custom-sura-modal');
        const gridBtn = document.getElementById('grid-view-btn');
        const timelineBtn = document.getElementById('timeline-view-btn');

        if (!modal) return;

        if (view === 'timeline') {
            modal.classList.add('timeline-view');
            gridBtn?.classList.remove('active');
            timelineBtn?.classList.add('active');
            
            // Scroll to current sura in timeline
            setTimeout(() => {
                const currentItem = document.querySelector('#timeline-scroll .timeline-item.current');
                if (currentItem) {
                    currentItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            }, 100);
        } else {
            modal.classList.remove('timeline-view');
            gridBtn?.classList.add('active');
            timelineBtn?.classList.remove('active');
            
            // Scroll to current sura in grid
            setTimeout(() => {
                const currentCard = document.querySelector('#sura-grid .sura-card.current');
                if (currentCard) {
                    currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }

    function showCustomSuraMenu() {
        const overlay = createCustomSuraMenu();
        
        // Update current sura highlight for both views
        const currentSura = getSureNumberFromUrl();
        
        // Update grid cards
        const cards = overlay.querySelectorAll('.sura-card');
        cards.forEach(card => {
            const num = parseInt(card.getAttribute('data-sura'), 10);
            card.classList.toggle('current', num === currentSura);
        });

        // Update timeline items
        const timelineItems = overlay.querySelectorAll('.timeline-item');
        timelineItems.forEach(item => {
            const num = parseInt(item.getAttribute('data-sura'), 10);
            item.classList.toggle('current', num === currentSura);
        });

        // Apply saved view preference
        setSuraView(currentSuraView);

        overlay.classList.add('visible');

        // Focus search and scroll to current based on view
        setTimeout(() => {
            const searchInput = overlay.querySelector('.sura-search-input');
            if (searchInput) searchInput.focus();

            if (currentSuraView === 'timeline') {
                const currentItem = overlay.querySelector('.timeline-item.current');
                if (currentItem) {
                    currentItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }
            } else {
                const currentCard = overlay.querySelector('.sura-card.current');
                if (currentCard) {
                    currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 150);
    }

    function hideCustomSuraMenu() {
        if (customSuraOverlay) {
            customSuraOverlay.classList.remove('visible');
        }
    }

    // Override sura navigation to use desktop URL format (?s=X)
    function overrideSuraNavigation() {
        // Override the global navigateToSura function
        window.navigateToSura = function(suraNumber) {
            const nextUrl = updateSureParam(suraNumber);
            window.location.href = nextUrl;
        };

        // Override createSuraSelectionMenu to show our custom menu
        window.createSuraSelectionMenu = function() {
            showCustomSuraMenu();
            return null; // Don't return the old menu
        };

        // Intercept clicks on sura header to show custom menu
        document.addEventListener('click', (e) => {
            const header = e.target.closest('#header');
            if (header && !e.target.closest('.settings-wrapper')) {
                e.preventDefault();
                e.stopPropagation();
                showCustomSuraMenu();
            }

            // Also intercept old menu items just in case
            const suraItem = e.target.closest('.sura-menu-item');
            if (suraItem) {
                const suraNumber = parseInt(suraItem.getAttribute('data-sura-number'), 10);
                if (suraNumber >= 1 && suraNumber <= 114) {
                    e.preventDefault();
                    e.stopPropagation();
                    const nextUrl = updateSureParam(suraNumber);
                    window.location.href = nextUrl;
                }
            }
        }, true);
    }

    function toggleSettings(forceState) {
        if (typeof forceState === 'boolean') {
            elements.settingsMenu.hidden = !forceState;
            return;
        }
        elements.settingsMenu.hidden = !elements.settingsMenu.hidden;
    }

    function bindSettings() {
        const limits = loadRootLimits();
        const chartEnabled = loadChartPreference();
        elements.sureInput.value = getSureNumberFromUrl();
        elements.topLimit.value = limits.top_roots ?? DEFAULT_ROOT_LIMIT;
        elements.distinctiveLimit.value = limits.distinctive_roots ?? DEFAULT_ROOT_LIMIT;
        elements.highKlLimit.value = limits.high_kl_roots ?? DEFAULT_ROOT_LIMIT;
        elements.n2nLimit.value = limits.n2_N_roots ?? DEFAULT_ROOT_LIMIT;
        if (elements.chartToggle) {
            elements.chartToggle.checked = chartEnabled;
        }

        elements.settingsButton.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleSettings();
        });
        elements.closeButton.addEventListener('click', () => toggleSettings(false));
        elements.settingsMenu.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        document.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const rootPanel = target.closest('#highlighted-roots-panel');
            if (!rootPanel) return;
            const selectedRoot = target.closest('[data-root]');
            const before = getSelectedWordSnapshot();
            const content = document.getElementById('highlighted-roots-content');
            const beforeLen = content ? content.innerHTML.length : 0;
            const rootColor = selectedRoot ? window.getComputedStyle(selectedRoot).backgroundColor : null;
            const order = getHighlightedWordOrderByColor(rootColor);
            rootClickTraceActive = true;
            console.log('[charts] root panel click', {
                hasRoot: !!selectedRoot,
                root: selectedRoot?.getAttribute('data-root') || null,
                chartEnabled: loadChartPreference(),
                shiftKey: event.shiftKey,
                ctrlKey: event.ctrlKey,
                before,
                beforeLen,
                rootStyle: selectedRoot ? window.getComputedStyle(selectedRoot).pointerEvents : null,
                orderPreview: order.slice(0, 5)
            });
            queueMicrotask(() => {
                const after = getSelectedWordSnapshot();
                const afterLen = content ? content.innerHTML.length : 0;
                const changed = JSON.stringify(before) !== JSON.stringify(after);
                console.log('[charts] root panel decision', { 
                    changed,
                    beforeAyah: before?.ayah, 
                    beforeWord: before?.wordIndex,
                    afterAyah: after?.ayah, 
                    afterWord: after?.wordIndex,
                    totalOrder: order.length 
                });
                rootClickTraceActive = false;
            });
        }, true);
        elements.applyButton.addEventListener('click', () => {
            const newSure = Math.max(1, Math.min(MAX_SURE, parseInt(elements.sureInput.value, 10) || DEFAULT_SURE));
            const newLimits = {
                top_roots: parseInt(elements.topLimit.value, 10),
                distinctive_roots: parseInt(elements.distinctiveLimit.value, 10),
                high_kl_roots: parseInt(elements.highKlLimit.value, 10),
                n2_N_roots: parseInt(elements.n2nLimit.value, 10)
            };

            Object.keys(newLimits).forEach(key => {
                if (Number.isNaN(newLimits[key])) {
                    newLimits[key] = DEFAULT_ROOT_LIMIT;
                }
            });

            saveRootLimits(newLimits);
            const chartOn = elements.chartToggle?.checked || false;
            saveChartPreference(chartOn);
            toggleSettings(false);
            const currentSure = getSureNumberFromUrl();
            if (newSure !== currentSure) {
                const nextUrl = updateSureParam(newSure);
                window.location.href = nextUrl;
                return;
            }
            cachedRootLimits = newLimits;
            updateRootPanelFromLimits(newLimits);
            if (chartOn) {
                updateRootChartMode(true, newLimits);
            } else {
                updateRootChartMode(false, newLimits);
            }
            updateMinimap();
        });
    }

    async function init() {
        bindSettings();
        const params = new URLSearchParams(window.location.search);
        if (!params.has('s')) {
            clearStoredSureNumber();
            updateSureParam(DEFAULT_SURE);
        }
        const sureNumber = getSureNumberFromUrl();
        await loadSuraContent(sureNumber);
    }

    init();
})();

