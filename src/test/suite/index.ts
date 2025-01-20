import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 120000,
    });

    const testsRoot = __dirname;
    const files = await glob('**/*.test.js', { cwd: testsRoot });
    files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
    // Run the mocha test
    return new Promise<void>((resolve, reject) => {
        try {
            mocha.timeout(120000);
            // Log the name of each test before it starts.
            const beforeEach: Mocha.Func = function (this: Mocha.Context, done: Mocha.Done) {
                console.log(
                    `Title:${this.currentTest?.parent?.title} test:${this.currentTest?.title}`,
                );
                done();
            };
            mocha.rootHooks({ beforeEach });
            mocha.run((failures) => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            return Promise.reject(err);
        }
    });
}
