# development

Requires Python 3.12+, Node.js 20+, host PHP for password hashing and fixture seeding, and Docker Compose. The container supplies PHP 8.2 with GD and mbstring.

```sh
npm ci
npx playwright install chromium firefox webkit
python3 tools/bootstrap.py
docker compose up --build -d --wait
npm test
python3 tools/check.py
```

Open <http://127.0.0.1:8088>. Fixture accounts are `reader`, `editor`, `editor2`, and `admin`, all with password `cesa-test-only`. Anonymous users read public pages; readers also see `private:*`; editors can edit/upload; administrators manage the wiki. This fixture is disposable and must stay on loopback.

Bootstrap verifies the downloads pinned in `tools/sources.json`, seeds through DokuWiki's storage/index APIs, and links `cesa/` into the wiki. It writes local user/group IDs to ignored `.env` settings so container writes remain owned by the host user. `--without-plugins` omits Wrap and MathJax. `--reset` replaces `.dev/wiki`; it refuses to overwrite an existing fixture without that flag.

Tests create isolated page IDs and restore temporary configuration. Do not run two test suites against the same fixture at once. Results, traces, and screenshots are written to ignored development directories. Configuration replacement happens inside the container to avoid bind-mount races. `CESA_URL` selects a local endpoint; `CESA_CHROMIUM_EXECUTABLE`, `CESA_FIREFOX_EXECUTABLE`, and `CESA_WEBKIT_EXECUTABLE` select browser binaries.

## Native PHP

PHP 8.2 with GD and mbstring can serve the fixture directly:

```sh
PHP_CLI_SERVER_WORKERS=4 php -d opcache.enable=0 -d display_errors=1 -d error_reporting=32767 -S 127.0.0.1:8088 -t .dev/wiki .dev/wiki/router.php
```

In another terminal, use `CESA_NATIVE=1 npm test` and `python3 tools/check.py --native`. The four-worker development-server option is unavailable on Windows. The router blocks protected directories because the PHP development server ignores `.htaccess`; use a proper web-server configuration for production.

## Releases

`python3 tools/release.py` writes `dist/cesa-1.0.0.tar.gz` and `dist/SHA256SUMS`. Only `cesa/` is packaged; hidden metadata is excluded. In a Git checkout, stage template changes before building. Sorted paths and fixed metadata make builds repeatable with the same Python/zlib toolchain.

File timestamps follow `template.info.txt`'s release date, or `SOURCE_DATE_EPOCH` when set. Advance the timestamp for each release so PHP's opcode cache can detect changed files.

After building the Docker image, `python3 tools/verify-release.py` checks reproducibility, installs clean archives without and with optional plugins, runs the browser suite and PHP/asset checks, and writes `docs/verification-results.json`. It replaces the disposable fixture.

For an existing fixture, install the archive by stopping the server, running `python3 tools/bootstrap.py --reset --archive dist/cesa-1.0.0.tar.gz`, and restarting it. Then run `npm test`, `python3 tools/check.py`, and `python3 tools/report.py`. Native reports use `CESA_NATIVE=1`.

Reports require a complete passing run without skips, retries, or runner errors. Per-test hashes bind the results to the extracted archive and actual browser versions. Filtered development runs cannot replace the published record. Reports use the local fixture on port 8088.

To resume source development, bootstrap without `--archive`, or sync `cesa/` into `.dev/wiki/lib/tpl/cesa/` and touch `.dev/wiki/conf/local.php` to invalidate compiled assets.
