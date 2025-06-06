import { defineConfig } from '@vscode/test-cli';

export default defineConfig([
    {
        label: 'unitTests',
        files: 'out/test/**/*.test.js',
        version: 'insiders',
        workspaceFolder: './testwsp/test.code-workspace',
        mocha: {
            timeout: 120000,
        },
    },
]);
