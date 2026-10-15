/* Bind browser evidence to the template and archive present during each test. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { base } = require('./fixture');
const root = path.resolve(__dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function tree(directory) {
    const files = [];
    function walk(current) {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue;
            const file = path.join(current, entry.name);
            if (entry.isDirectory()) walk(file);
            else if (entry.isFile()) files.push(file);
            else throw new Error(`Unsupported template entry: ${file}`);
        }
    }
    walk(directory);
    return sha(files.sort().map(file => `${path.relative(directory, file).split(path.sep).join('/')}\0${sha(fs.readFileSync(file))}\n`).join(''));
}
module.exports = function evidence(browser) {
    const archive = path.join(root, 'dist/cesa-1.0.0.tar.gz');
    const installed = path.join(root, '.dev/wiki/lib/tpl/cesa');
    return {
        browser_version: browser.version(),
        archive_sha256: fs.existsSync(archive) ? sha(fs.readFileSync(archive)) : null,
        source_tree_sha256: tree(path.join(root, 'cesa')),
        installed_tree_sha256: tree(installed),
        installed_symlink: fs.lstatSync(installed).isSymbolicLink(),
        base_url: base,
    };
};
