# plugin repairs

These patches fix upstream PHP and DokuWiki compatibility problems. They are optional and do not affect the template's link or admin styling.

- Confmanager 2023-07-08: removes an optional parameter before a required parameter, which emits a deprecation on PHP 8.2.
- Hiding IPs 2018-11-05: handles Mort's revision and recent-changes form events, masks IPv4 and IPv6 editor addresses in those lists and diffs, and retains the configured administrator/manager exemption. The original plugin leaves revision IPs visible on Mort, including with the stock template.

## Browser repair

No shell access is needed. With Cesa enabled, log in as an administrator, open Extension Manager, and follow **Plugin compatibility**. Each **Repair** button updates one known plugin file using PHP. The page also works without JavaScript.

The repair checks the file's SHA-256 before and after applying the bundled diff. Unrecognized versions and linked files are refused. PHP must be able to write the plugin file and its directory. Each original is backed up under DokuWiki's protected metadata directory, in `_cesa_compat/`. **Restore original** reverses the repair from that verified backup. Keep that directory until you no longer need to roll back.

An upstream plugin update can replace the fix. Revisit the repair page afterward; an unfamiliar version is left alone. A wiki with full PHP diagnostics enabled may show Confmanager's existing deprecation on the first visit, before its file is repaired.

The repair asks PHP to invalidate the changed file's opcode cache. If hosting restrictions prevent that, the page reports that only the disk file was changed. Reset PHP's cache through your hosting panel or contact your host before relying on the fix.

## Command line

Alternatively, back up each plugin directory. From the wiki root:

```sh
patch --dry-run -d lib/plugins/confmanager -p1 < lib/tpl/cesa/compat/confmanager-php82.patch
patch -d lib/plugins/confmanager -p1 < lib/tpl/cesa/compat/confmanager-php82.patch

patch --dry-run -d lib/plugins/hidingip -p1 < lib/tpl/cesa/compat/hidingip-mort.patch
patch -d lib/plugins/hidingip -p1 < lib/tpl/cesa/compat/hidingip-mort.patch
touch conf/local.php
```

Reload the browser after patching. Restore the backed-up plugin directory to roll back.

The test fixture pins the exact source commits and applies both patches before running its checks. See [sources.json](https://github.com/computatorium/cesa/blob/main/tools/sources.json).
