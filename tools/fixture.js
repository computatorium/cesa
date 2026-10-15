const fs = require('node:fs/promises');
const path = require('node:path');
const execFile = require('node:util').promisify(require('node:child_process').execFile);
const root = path.resolve(__dirname, '..');
const endpoint = new URL(process.env.CESA_URL || 'http://127.0.0.1:8088');
if (!['http:', 'https:'].includes(endpoint.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) ||
    endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('CESA_URL must be a loopback origin for the disposable fixture.');
}

async function atomicWrite(target, contents) {
    target = path.resolve(target);
    if (!target.startsWith(path.join(root, '.dev/wiki/conf') + path.sep)) {
        throw new Error('Configuration writes are limited to .dev/wiki/conf/.');
    }
    if (!process.env.CESA_NATIVE) {
        // Host-side renames can race reads across Docker's bind mount.
        const destination = '/workspace/' + path.relative(root, target).split(path.sep).join('/');
        const code = 'if(file_put_contents($argv[1].".cesa-test",base64_decode($argv[2],true))===false||!rename($argv[1].".cesa-test",$argv[1]))exit(1);';
        try {
            await execFile('docker', ['compose', 'exec', '-T', 'wiki', 'php', '-r', code, destination, Buffer.from(contents).toString('base64')], { cwd: root });
            return;
        } catch (error) {
            if (error.code !== 'ENOENT' && !/not running|cannot connect to the docker|daemon is not running/i.test(error.stderr || '')) throw error;
        }
    }
    await fs.writeFile(`${target}.cesa-test`, contents);
    await fs.rename(`${target}.cesa-test`, target);
}

module.exports = { base: endpoint.origin, atomicWrite };
