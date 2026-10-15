(function () {
    'use strict';
    var root = document.documentElement;
    var allowed = ['system', 'light', 'dark'];
    var preference = root.getAttribute('data-appearance') || 'system';
    var query = window.matchMedia('(prefers-color-scheme: dark)');
    try {
        var stored = localStorage.getItem('cesa.appearance');
        if (allowed.indexOf(stored) !== -1) preference = stored;
    } catch (_) { /* Keep the configured default when storage is blocked. */ }
    function apply() {
        root.setAttribute('data-appearance', preference);
        root.setAttribute('data-theme', preference === 'system' ? (query.matches ? 'dark' : 'light') : preference);
        document.querySelectorAll('.cesa-appearance button').forEach(function (button) {
            button.setAttribute('aria-pressed', String(button.getAttribute('data-appearance') === preference));
        });
    }
    window.cesaAppearance = function (value) {
        if (allowed.indexOf(value) === -1) return;
        preference = value;
        try { localStorage.setItem('cesa.appearance', value); } catch (_) {}
        apply();
    };
    if (query.addEventListener) query.addEventListener('change', apply);
    else query.addListener(apply);
    window.addEventListener('storage', function (event) {
        if (event.key !== 'cesa.appearance' && event.key !== null) return;
        preference = allowed.indexOf(event.newValue) !== -1 ? event.newValue : (root.getAttribute('data-default-appearance') || 'system');
        apply();
    });
    root.classList.remove('no-js');
    root.classList.add('js');
    apply();
}());
