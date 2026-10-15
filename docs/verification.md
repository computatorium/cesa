# verification

The [test record](verification-results.json) contains the tested archive checksum, PHP/browser versions, individual results, and asset measurements. It is written by `tools/report.py` only after checking a complete passing run against the extracted archive and source files.

The fixture runs DokuWiki 2026-07-14c “Mort” on PHP 8.2. Browser workflows run in Chromium, Firefox, and WebKit through Playwright. Reproduce them with the [development commands](development.md), or run `python3 tools/verify-release.py` for clean release installations.

GitHub Actions runs the same checks for builds and version tags. Releases include `verification-results.json` from the publishing run, alongside the archive and checksum.

Coverage includes:

- Create, repeated preview without saving, save, cancel, section editing, toolbar, summaries, drafts, locks, and conflicting edits.
- Upload/insertion, media management and image detail; search, sitemap, history/diff, backlinks, recent changes, authentication, profiles, subscriptions, and bundled administration.
- Anonymous/reader/editor/administrator ACLs, private navigation, raw export, discovery surfaces, and private media.
- Light/dark/system appearance, persistence and first paint, blocked storage, JavaScript-disabled reading/editing, keyboard use, RTL, print, and enlarged text.
- Layouts at 360, 390, 768, 1280, and 1920 CSS pixels, local table/code/math overflow, shared control sizing, and the common article-width column.
- Form controls, named option groups, reassigned-form resets, removal/reinsertion, and shared header control fonts and sizing.
- Configuration, disabled actions, include hooks, palette overrides, optional Wrap/MathJax rendering, PHP syntax/runtime diagnostics, and compressed template asset budgets.
- Linkfavicon icons in articles, navigation, and previews; CMS mode's anonymous controls; Hiding IPs' revision output; Confmanager selection, save/delete, and icon dialogs; mobile Extension Manager and ACL controls.
- Browser-based plugin repair and restoration without JavaScript; administrator access, CSRF rejection, checksums, read-only/linked files, corrupted backups, and the source-linked template entry point.

The gzip limits are 40 KiB CSS and 5 KiB JavaScript, excluding core/plugins. CSS is compiled with Mort's pipeline. The JavaScript figure sums three separately gzipped parts: the inline appearance script, `script.js` after Mort's JSStrip minifier, and locale strings. Raw source gzip bytes are recorded too.

Representative [light](screenshots/light.png) and [dark](screenshots/dark.png) screenshots are included. The suite writes additional captures locally. Browser reflow and keyboard checks do not replace testing with physical devices or screen readers. Email delivery, external authentication servers, and installation through Extension Manager are not exercised.

## Optional dependencies

Exact commits and archive checksums are pinned in [sources.json](../tools/sources.json).

| Component | Version |
| --- | --- |
| Wrap | 2026-06-02; `0fe74b4d407fca551e2bc1aefb19a5279d5cdd0d` |
| MathJax plugin | 2026-10-05; `607d91741b0d54854e67f76e21d110632736840c` |
| MathJax runtime | 2.7.9, development fixture only |
| Linkfavicon | 2024-10-27; `a7499042b7c8e37eaae56eaa31451edc9a968704` |
| CMS mode | 2023-08-16; `5249b761d6303fb760f846a97f110282c09b2ecc` |
| Confmanager | 2023-07-08; `1b5b7c23c39a6cc32d8e1f1eefcd1818d80207ae` |
| Hiding IPs | 2018-11-05; `d5a1331cece8b0cbb5f3d8cb49162bd83a808086` |

## Upstream behavior

The fixture applies the [optional patches](../cesa/compat/README.md) to the pinned Confmanager and Hiding IPs sources. All checks retain `E_ALL`. Patch hashes are included in the verification record. Confmanager's original constructor emits a PHP 8.2 deprecation, and Hiding IPs' old revision/recent hooks do not run on Mort. Both issues also occur with the stock template. External favicon requests use a local test response so the icon checks do not depend on the favicon service.

Repair tests disable the two plugins while restoring their original files, then exercise PHP repairs and rollback under `E_ALL`. A separate PHP 8.2 check reproduces stale execution with OPCache timestamp checks and API access disabled, and verifies that the repair reports a required hosting cache reset.

Mort's native draft cleanup issues an asynchronous POST during unload. WebKit can reject it with `ajax.php due to access control checks`. The same diagnostic was reproduced with the stock template; see [evidence](upstream-unload.json) and `node tools/upstream-unload.js`. The suite ignores that exact message in WebKit and fails on other uncaught page errors. Draft/save/cancel checks still run.

An unauthorized raw export returns an HTML Permission Denied page, observed with HTTP 200. Tests accept HTTP 200 or 403 and check that private content is absent. Unauthorized private media returns HTTP 403.

The tested MathJax plugin requires the version 2 Hub API. Runtime 2.7.9 has the upstream [ReDoS advisory](https://github.com/advisories/GHSA-v638-q856-grg8); it is not included in the template archive. MathJax 3/4 require a different plugin integration. Without JavaScript, mathematics remains TeX source.
