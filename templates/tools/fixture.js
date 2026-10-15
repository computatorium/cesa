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

function fixtureFile(target) {
    target = path.resolve(target);
    const repairFiles = ['confmanager/configTypes/ConfigManagerTwoLine.php', 'hidingip/action.php']
        .map(name => path.join(root, '.dev/wiki/lib/plugins', name));
    if (!target.startsWith(path.join(root, '.dev/wiki/conf') + path.sep) && !repairFiles.includes(target)) {
        throw new Error('Fixture writes are limited to configuration and the two plugin repair files.');
    }
    return target;
}

async function containerFile(target, code, args = []) {
    if (!process.env.CESA_NATIVE) {
        // Host-side mutations can race reads across Docker's bind mount.
        const destination = '/workspace/' + path.relative(root, target).split(path.sep).join('/');
        try {
            await execFile('docker', ['compose', 'exec', '-T', 'wiki', 'php', '-r', code, destination, ...args], { cwd: root });
            return true;
        } catch (error) {
            if (error.code !== 'ENOENT' && !/not running|cannot connect to the docker|daemon is not running/i.test(error.stderr || '')) throw error;
        }
    }
    return false;
}

async function atomicWrite(target, contents) {
    target = fixtureFile(target);
    const code = 'if(file_put_contents($argv[1].".cesa-test",base64_decode($argv[2],true))===false||!rename($argv[1].".cesa-test",$argv[1]))exit(1);';
    if (await containerFile(target, code, [Buffer.from(contents).toString('base64')])) return;
    await fs.writeFile(`${target}.cesa-test`, contents);
    await fs.rename(`${target}.cesa-test`, target);
}

async function removeFile(target) {
    target = fixtureFile(target);
    const code = 'if((file_exists($argv[1])||is_link($argv[1]))&&!unlink($argv[1]))exit(1);';
    if (await containerFile(target, code)) return;
    await fs.rm(target, { force: true });
}

module.exports = { base: endpoint.origin, atomicWrite, removeFile };
