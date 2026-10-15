const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    fullyParallel: false,
    workers: 1,
    timeout: 45_000,
    expect: { timeout: 8_000 },
    reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }], ['html', { open: 'never' }]],
    use: {
        baseURL: process.env.CESA_URL || 'http://127.0.0.1:8088',
        viewport: { width: 1280, height: 960 },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: ['chromium', 'firefox', 'webkit'].map(browserName => ({
        name: browserName,
        use: {
            browserName,
            launchOptions: process.env[`CESA_${browserName.toUpperCase()}_EXECUTABLE`]
                ? { executablePath: process.env[`CESA_${browserName.toUpperCase()}_EXECUTABLE`] } : {},
        },
    })),
});
