# plugin patches

These patches fix upstream PHP and DokuWiki compatibility problems. They are optional and do not affect the template's link or admin styling.

- Confmanager 2023-07-08: removes an optional parameter before a required parameter, which emits a deprecation on PHP 8.2.
- Hiding IPs 2018-11-05: handles Mort's revision and recent-changes form events, masks IPv4 and IPv6 editor addresses in those lists and diffs, and retains the configured administrator/manager exemption. The original plugin leaves revision IPs visible on Mort, including with the stock template.

Back up each plugin directory. From the wiki root, check each patch before applying it:

```sh
patch --dry-run -d lib/plugins/confmanager -p1 < lib/tpl/cesa/compat/confmanager-php82.patch
patch -d lib/plugins/confmanager -p1 < lib/tpl/cesa/compat/confmanager-php82.patch

patch --dry-run -d lib/plugins/hidingip -p1 < lib/tpl/cesa/compat/hidingip-mort.patch
patch -d lib/plugins/hidingip -p1 < lib/tpl/cesa/compat/hidingip-mort.patch
touch conf/local.php
```

Reload the browser after patching. An upstream plugin update may replace the patched files; check whether it already includes these fixes before applying a patch again. Restore the backed-up plugin directory to roll back.

The test fixture pins the exact source commits and applies both patches before running its checks. See [sources.json](https://github.com/computatorium/cesa/blob/main/tools/sources.json).
