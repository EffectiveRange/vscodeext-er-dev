import * as path from 'path';
import * as cp from 'child_process';

import {
    downloadAndUnzipVSCode,
    resolveCliArgsFromVSCodeExecutablePath,
    runTests,
} from '@vscode/test-electron';

const packageJson = require('../../package.json');

process.env.IS_CI_SERVER_TEST_DEBUGGER = '1';
process.env.VSC_PYTHON_CI_TEST = '1';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        const vscodeExecutablePath = await downloadAndUnzipVSCode();

        const [cli, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);
        if (packageJson.extensionDependencies) {
            for (const extensionId of packageJson.extensionDependencies) {
                console.log(`Installing ${extensionId}`);
                cp.spawnSync(cli, [...args, '--force', '--install-extension', extensionId], {
                    encoding: 'utf-8',
                    stdio: 'inherit',
                    env: {
                        DONT_PROMPT_WSL_INSTALL: '1',
                    },
                });
            }
        }

        // Download VS Code, unzip it and run the integration test
        await runTests({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                ...args,
                '-n',
                path.resolve(extensionDevelopmentPath, 'testwsp/test.code-workspace'),
            ],
            extensionTestsEnv: {
                DONT_PROMPT_WSL_INSTALL: '1',
            },
        });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
