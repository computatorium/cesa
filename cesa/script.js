(function () {
    'use strict';
    // The native select remains the submitted field and core API.
    var selects = new WeakMap(), closeSelect, placeSelect, nextSelect = 0;
    function enhanceSelect(select) {
        if (!select.isConnected) return;
        if (selects.has(select)) { selects.get(select).place(); return; }
        if (select.parentElement.classList.contains('cesa-select')) select.parentElement.replaceWith(select);
        var attributes = ['tabindex', 'aria-hidden'], original = attributes.map(function (attr) { return select.getAttribute(attr); });
        var wrapper = document.createElement('span'), trigger = document.createElement('button');
        var list = document.createElement('div'), active = -1, options = [], search = '', searchTime = 0;
        var strings = window.LANG && LANG.template && LANG.template.cesa;
        var revision = { 'rev2[0]': 'older_revision', 'rev2[1]': 'newer_revision' }[select.name];
        var name = select.getAttribute('aria-label') || Array.from(select.labels || []).map(function (label) {
            var copy = label.cloneNode(true);
            copy.querySelectorAll('select').forEach(function (node) { node.remove(); });
            return copy.textContent.trim();
        }).join(' ') || select.title || (strings && strings[revision]) || select.name || (strings && strings.choose_option) || '';
        wrapper.className = 'cesa-select';
        // Core quickSelect hides buttons unless they opt in with .show.
        trigger.className = 'cesa-select-trigger show';
        trigger.type = 'button';
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-label', name);
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        list.id = 'cesa-select-' + (++nextSelect);
        list.className = 'cesa-select-options';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', name);
        list.hidden = true;
        list.addEventListener('pointerdown', function (event) { event.preventDefault(); });
        trigger.setAttribute('aria-controls', list.id);
        ['aria-describedby', 'aria-labelledby'].forEach(function (attr) {
            if (select.hasAttribute(attr)) trigger.setAttribute(attr, select.getAttribute(attr));
        });
        select.before(wrapper);
        wrapper.append(select, trigger);
        document.body.append(list);
        select.classList.add('cesa-select-native');
        select.tabIndex = -1;
        select.setAttribute('aria-hidden', 'true');
        function disabled(option) { return option.disabled || option.hidden || option.parentElement.disabled || option.parentElement.hidden; }
        function sync() {
            var text = Array.from(select.selectedOptions).map(function (option) { return option.label; }).join(', ') || '—';
            if (trigger.textContent !== text) trigger.textContent = text;
            trigger.disabled = select.disabled;
            wrapper.hidden = select.hidden || select.style.display === 'none';
            if (select.disabled || wrapper.hidden) close(false);
            trigger.setAttribute('aria-required', String(select.required));
            trigger.setAttribute('aria-invalid', select.getAttribute('aria-invalid') || 'false');
            if (!list.hidden) { render(); position(); }
        }
        function close(focus) {
            search = '';
            list.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            trigger.removeAttribute('aria-activedescendant');
            if (closeSelect === close) { closeSelect = null; placeSelect = null; }
            if (focus && trigger.isConnected) trigger.focus();
        }
        function highlight(index) {
            active = index;
            list.querySelectorAll('[role="option"]').forEach(function (node, i) {
                node.classList.toggle('is-active', i === index);
            });
            var node = list.querySelector('[data-index="' + index + '"]');
            if (node) {
                trigger.setAttribute('aria-activedescendant', node.id);
                node.scrollIntoView({ block: 'nearest' });
            }
        }
        function choose(index) {
            var option = options[index];
            if (!option || disabled(option)) return;
            if (select.multiple) option.selected = !option.selected;
            else { select.selectedIndex = index; close(true); }
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            sync();
        }
        function render() {
            options = Array.from(select.options);
            list.replaceChildren();
            list.setAttribute('aria-multiselectable', String(select.multiple));
            var group, container = list;
            options.forEach(function (option, index) {
                if (option.parentElement.tagName === 'OPTGROUP' && group !== option.parentElement) {
                    group = option.parentElement;
                    container = document.createElement('div');
                    container.setAttribute('role', 'group');
                    container.setAttribute('aria-label', group.label);
                    container.hidden = group.hidden;
                    var heading = document.createElement('div');
                    heading.className = 'cesa-option-group';
                    heading.textContent = group.label;
                    heading.setAttribute('aria-hidden', 'true');
                    container.append(heading);
                    list.append(container);
                } else if (option.parentElement.tagName !== 'OPTGROUP') container = list;
                var node = document.createElement('div');
                node.id = list.id + '-' + index;
                node.setAttribute('role', 'option');
                node.setAttribute('aria-selected', String(option.selected));
                node.setAttribute('aria-disabled', String(disabled(option)));
                node.dataset.index = index;
                node.textContent = option.label;
                node.hidden = option.hidden || option.parentElement.hidden;
                node.addEventListener('click', function () { choose(index); });
                container.append(node);
            });
            highlight(active);
        }
        function open() {
            if (trigger.disabled) return;
            if (closeSelect) closeSelect(false);
            sync();
            active = select.selectedIndex;
            render();
            list.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            closeSelect = close;
            placeSelect = position;
            list.style.font = getComputedStyle(trigger).font;
            list.style.direction = getComputedStyle(trigger).direction;
            list.style.setProperty('--control-height', getComputedStyle(trigger).getPropertyValue('--control-height'));
            position();
            highlight(active);
        }
        function position() {
            var rect = trigger.getBoundingClientRect(), unit = parseFloat(getComputedStyle(document.documentElement).fontSize), gap = unit / 2;
            if (rect.bottom < 0 || rect.top > innerHeight) { close(false); return; }
            var width = Math.min(Math.max(rect.width, 12 * unit), innerWidth - 2 * gap);
            var below = innerHeight - rect.bottom - gap, above = rect.top - gap;
            var height = Math.min(18 * unit, Math.max(below, above));
            list.style.width = width + 'px';
            list.style.maxHeight = Math.max(unit * 2, height) + 'px';
            var start = list.style.direction === 'rtl' ? rect.right - width : rect.left;
            list.style.left = Math.max(gap, Math.min(start, innerWidth - width - gap)) + 'px';
            list.style.top = (below >= Math.min(18 * unit, above) ? rect.bottom : Math.max(gap, rect.top - Math.min(list.scrollHeight, height))) + 'px';
        }
        trigger.addEventListener('click', function () { trigger.focus(); if (list.hidden) open(); else close(false); });
        trigger.addEventListener('blur', function () { close(false); });
        trigger.addEventListener('keydown', function (event) {
            var key = event.key;
            if (key === 'Tab') { close(false); return; }
            if (key === 'Escape') { if (!list.hidden) { close(true); event.preventDefault(); } return; }
            if (key === 'Enter' || (key === ' ' && (!search || Date.now() - searchTime > 700))) {
                event.preventDefault();
                if (list.hidden) open(); else choose(active);
                return;
            }
            if (event.altKey && (key === 'ArrowDown' || key === 'ArrowUp')) {
                event.preventDefault();
                if (key === 'ArrowDown' && list.hidden) open();
                else if (key === 'ArrowUp' && !list.hidden) { if (!select.multiple) choose(active); close(true); }
                return;
            }
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].indexOf(key) !== -1) {
                event.preventDefault();
                if (list.hidden) { open(); if (key.indexOf('Arrow') === 0) return; }
                var step = key === 'ArrowUp' || key === 'End' ? -1 : 1;
                var index = key === 'Home' ? 0 : key === 'End' ? options.length - 1 : active + step;
                while (index >= 0 && index < options.length && disabled(options[index])) index += step;
                if (index >= 0 && index < options.length) highlight(index);
            } else if (key.length === 1) {
                event.preventDefault();
                if (list.hidden) open();
                search = Date.now() - searchTime > 700 ? key : search + key;
                searchTime = Date.now();
                var index = options.findIndex(function (option) { return !disabled(option) && option.label.toLocaleLowerCase().indexOf(search.toLocaleLowerCase()) === 0; });
                if (index !== -1) highlight(index);
            }
        });
        function focus() { trigger.focus(); }
        function invalid() { trigger.setAttribute('aria-invalid', 'true'); focus(); }
        select.addEventListener('focus', focus);
        select.addEventListener('invalid', invalid);
        if (window.jQuery) jQuery(select).on('change.cesa', sync); else select.addEventListener('change', sync);
        sync.dispose = function () {
            close(false);
            list.remove();
            select.removeEventListener('focus', focus);
            select.removeEventListener('invalid', invalid);
            if (window.jQuery) jQuery(select).off('change.cesa', sync); else select.removeEventListener('change', sync);
            selects.delete(select);
            select.classList.remove('cesa-select-native');
            attributes.forEach(function (attr, i) { if (original[i] === null) select.removeAttribute(attr); else select.setAttribute(attr, original[i]); });
            if (!wrapper.contains(select)) wrapper.remove();
        };
        sync.place = function () {
            if (select.parentElement !== wrapper) { select.before(wrapper); wrapper.prepend(select); }
            sync();
        };
        selects.set(select, sync);
        sync();
    }
    function enhanceControls(root) {
        if (root.matches && root.matches('select')) enhanceSelect(root);
        if (root.querySelectorAll) root.querySelectorAll('select').forEach(enhanceSelect);
    }
    function ready() {
        enhanceControls(document);
        document.addEventListener('reset', function (event) {
            setTimeout(function () { Array.from(event.target.elements || []).forEach(function (select) { if (selects.has(select)) selects.get(select)(); }); }, 0);
        }, true);
        new MutationObserver(function (records) {
            records.forEach(function (record) {
                var select = record.target.closest && record.target.closest('select');
                if (select && selects.has(select)) selects.get(select)();
                record.addedNodes.forEach(enhanceControls);
                record.removedNodes.forEach(function (node) {
                    var removed = node.querySelectorAll ? Array.from(node.querySelectorAll('select')) : [];
                    if (node.matches && node.matches('select')) removed.push(node);
                    removed.forEach(function (select) { if (!select.isConnected && selects.has(select)) selects.get(select).dispose(); });
                });
            });
        }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'style', 'selected', 'label', 'multiple', 'required', 'aria-invalid'] });
        document.addEventListener('pointerdown', function (event) {
            if (closeSelect && !event.target.closest('.cesa-select, .cesa-select-options')) closeSelect(false);
            if (!event.target.closest('.cesa-select-options')) document.querySelectorAll('.cesa-menu[open]').forEach(function (menu) { if (!menu.contains(event.target)) menu.open = false; });
        });
        addEventListener('resize', function () { if (placeSelect) placeSelect(); });
        addEventListener('scroll', function (event) {
            if (placeSelect && !(event.target.closest && event.target.closest('.cesa-select-options'))) placeSelect();
        }, true);
        document.querySelectorAll('.cesa-appearance').forEach(function (group) {
            group.hidden = false;
            group.querySelectorAll('button').forEach(function (button) {
                var mode = button.getAttribute('data-appearance');
                button.setAttribute('aria-pressed', String(mode === document.documentElement.getAttribute('data-appearance')));
                button.addEventListener('click', function () { window.cesaAppearance(mode); group.open = false; group.querySelector('summary').focus(); });
            });
        });
        var site = document.getElementById('dokuwiki__top');
        var aside = document.getElementById('dokuwiki__aside');
        var lastSize = '', inMargin;
        function navigation() {
            if (!site) return;
            var size = [innerWidth, site.clientWidth, getComputedStyle(site).fontSize].join(':');
            if (size !== lastSize && aside) {
                lastSize = size;
                site.classList.add('cesa-rail-margin');
                var box = aside.getBoundingClientRect();
                var gutter = parseFloat(getComputedStyle(document.getElementById('dokuwiki__site')).paddingInlineStart);
                var fits = box.left >= gutter && box.right <= innerWidth - gutter;
                site.classList.toggle('cesa-rail-margin', fits);
                if (fits !== inMargin) document.querySelectorAll('.cesa-navigation').forEach(function (details) { details.open = fits; });
                inMargin = fits;
            }
            document.documentElement.style.setProperty('--navigation-offset', (aside && !site.classList.contains('cesa-rail-margin') ? aside.offsetHeight : 0) + 'px');
        }
        navigation();
        if (aside) aside.addEventListener('click', function (event) {
            if (!site.classList.contains('cesa-rail-margin') && event.target.closest('a[href*="#"]')) {
                aside.querySelectorAll('details').forEach(function (details) { details.open = false; });
                navigation();
            }
        });
        addEventListener('resize', navigation);
        if (site) new ResizeObserver(navigation).observe(site);
        var strings = window.LANG && LANG.template && LANG.template.cesa;
        // Keep core's delegated image handler and AJAX namespace loading intact.
        var tree = document.getElementById('media__tree');
        if (tree && strings) {
            function treeButtons() {
                tree.querySelectorAll('li > img[src$="/plus.gif"], li > img[src$="/minus.gif"]').forEach(function (img) {
                    var button = img.previousElementSibling;
                    if (!button || !button.classList.contains('cesa-tree-toggle')) {
                        button = document.createElement('button');
                        button.type = 'button';
                        button.className = 'cesa-tree-toggle';
                        button.addEventListener('click', function () { img.click(); });
                        img.before(button);
                        img.hidden = true;
                    }
                    var open = img.parentElement.classList.contains('open');
                    var symbol = open ? '−' : '+';
                    if (button.textContent !== symbol) button.textContent = symbol;
                    var link = img.parentElement.querySelector('.li a');
                    button.setAttribute('aria-expanded', String(open));
                    button.setAttribute('aria-label', strings[open ? 'collapse_namespace' : 'expand_namespace'] + (link ? ': ' + link.textContent : ''));
                });
            }
            treeButtons();
            new MutationObserver(treeButtons).observe(tree, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        }
        var scrolling = new ResizeObserver(function (entries) {
            entries.forEach(function (entry) {
                var region = entry.target, overflows = region.scrollWidth > region.clientWidth;
                if (overflows) {
                    region.tabIndex = 0;
                    region.setAttribute('role', 'region');
                    if (strings) region.setAttribute('aria-label', strings[region.classList.contains('table') ? 'scroll_table' : 'scroll_code']);
                } else ['tabindex', 'role', 'aria-label'].forEach(function (attr) { region.removeAttribute(attr); });
            });
        });
        document.querySelectorAll('.page .table, .page pre.code, .page pre.file').forEach(function (region) {
            scrolling.observe(region);
            region.addEventListener('keydown', function (event) {
                if (event.target !== region || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                var step = event.key === 'ArrowRight' ? 64 : (event.key === 'ArrowLeft' ? -64 : 0);
                if (!step || region.scrollWidth <= region.clientWidth) return;
                region.scrollLeft += step;
                event.preventDefault();
            });
        });
        // Place core's footnote popup outside the link's hit area.
        document.addEventListener('mouseover', function (event) {
            var link = event.target.closest('a.fn_top'), popup = document.getElementById('insitu__fn');
            if (!popup || !window.jQuery) return;
            if (!link) {
                if (!popup.contains(event.target)) setTimeout(function () {
                    if (!popup.matches(':hover') && !document.querySelector('a.fn_top:hover')) jQuery(popup).hide().attr('aria-hidden', 'true');
                }, 120);
                return;
            }
            var edge = getComputedStyle(link).direction === 'rtl' ? 'right' : 'left';
            var gap = parseFloat(getComputedStyle(document.documentElement).fontSize) / 2;
            jQuery(popup).position({ my: edge + ' top', at: edge + ' bottom+' + gap, of: link, collision: 'flipfit' });
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Tab') setTimeout(function () {
                document.querySelectorAll('.cesa-menu[open]').forEach(function (menu) { if (!menu.contains(document.activeElement)) menu.open = false; });
            }, 0);
            if (event.key !== 'Escape' || event.defaultPrevented) return;
            if (window.jQuery) jQuery('#insitu__fn').hide().attr('aria-hidden', 'true');
            var menus = document.querySelectorAll('.cesa-menu[open]');
            var menu = document.activeElement.closest('.cesa-menu[open]') || menus[menus.length - 1];
            menus.forEach(function (item) { item.open = false; });
            if (menu) menu.querySelector('summary').focus();
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
    else ready();
}());
