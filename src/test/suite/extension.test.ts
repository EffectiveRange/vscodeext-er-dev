import * as assert from 'assert';
import { existsSync, rmSync, rmdirSync, unlink } from 'fs';
import path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { delay, getExtensionHandle, openWorkspaceFile, projectFilePath } from '../utils';
import * as sinon from 'sinon';
import { getWorkspace } from '../utils';
import { spawn, spawnSync } from 'child_process';
import { ErDevApi } from '../../api';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    suiteSetup(async function (this: Mocha.Context) {
        this.timeout(100000);
    });

    setup(async function (this: Mocha.Context) {
        this.timeout(100000);
        //cleanup
        rmSync('/tmp/fpm', { force: true, recursive: true });
        for (const wsp of vscode.workspace.workspaceFolders ?? []) {
            rmSync(`${path.join(wsp.uri.fsPath, 'build')}`, { force: true, recursive: true });
            rmSync(`${path.join(wsp.uri.fsPath, 'dist')}`, { force: true, recursive: true });
            if (wsp.name.endsWith('wheel')) {
                const buff = spawnSync('sudo', [
                    'pip',
                    'uninstall',
                    '-y',
                    wsp.name.replace('_', '-'),
                ]);
            } else {
                const pkgName = wsp.name.startsWith('py') ? `python3-${wsp.name}` : wsp.name;
                const buff = spawnSync('sudo', ['apt', 'remove', '-y', pkgName]);
            }
        }
        const tabs: vscode.Tab[] = vscode.window.tabGroups.all.map((tg) => tg.tabs).flat();
        await vscode.window.tabGroups.close(tabs);
    });
    suiteTeardown(async () => {});

    teardown(async function (this: Mocha.Context) {});

    test('pack cmake project proj1', async () => {
        const wsp = getWorkspace('proj1');
        assert.notStrictEqual(wsp, undefined);
        await openWorkspaceFile(wsp, 'main.cpp');
        await vscode.commands.executeCommand('cmake.setKitByName', '__scanforkits__', wsp);
        await vscode.commands.executeCommand('cmake.setVariant', wsp, 'Debug');
        await vscode.commands.executeCommand('cmake.stop');
        await vscode.commands.executeCommand('erdev.packProject');
        const exist = existsSync(path.join(`${wsp.uri.fsPath}`, 'build', 'proj1_1.0.0_amd64.deb'));
        assert.strictEqual(exist, true);
        return true;
    });

    test('pack cmake project proj2', async () => {
        const wsp = getWorkspace('proj2');
        assert.notStrictEqual(wsp, undefined);
        await openWorkspaceFile(wsp, 'main.cpp');
        await vscode.commands.executeCommand('cmake.setKitByName', '__scanforkits__', wsp);
        await vscode.commands.executeCommand('cmake.setVariant', wsp, 'Debug');
        await vscode.commands.executeCommand('cmake.stop');
        await vscode.commands.executeCommand('erdev.packProject');
        assert.strictEqual(
            existsSync(path.join(`${wsp.uri.fsPath}`, 'build', 'proj2_1.0.0_amd64.deb')),
            true,
        );
        return true;
    });

    test('pack python project', async () => {
        const wsp2 = getWorkspace('pyproj');
        assert.notStrictEqual(wsp2, undefined);
        await openWorkspaceFile(wsp2, 'bin', 'pyproj');
        await vscode.commands.executeCommand('erdev.packProject');
        assert.strictEqual(
            existsSync(`${wsp2.uri.fsPath}/dist/python3-pyproj_1.0.0_all.deb`),
            true,
        );
        return true;
    });

    test('pack python project wheel', async () => {
        const wsp2 = getWorkspace('pyproj_wheel');
        assert.notStrictEqual(wsp2, undefined);
        await openWorkspaceFile(wsp2, 'bin', 'pyproj_wheel');
        await vscode.commands.executeCommand('erdev.packProject');
        assert.strictEqual(
            existsSync(`${wsp2.uri.fsPath}/dist/pyproj_wheel-1.0.0-py3-none-any.whl`),
            true,
        );
        return true;
    });

    test('deploy cmake project proj1', async () => {
        const wsp = getWorkspace('proj1');
        assert.notStrictEqual(wsp, undefined);
        await openWorkspaceFile(wsp, 'main.cpp');
        await vscode.commands.executeCommand('cmake.setKitByName', '__scanforkits__', wsp);
        await vscode.commands.executeCommand('cmake.setVariant', wsp, 'Debug');
        await vscode.commands.executeCommand('cmake.stop');
        const handle = await getExtensionHandle();
        const api = handle.exports as ErDevApi;
        api.setActiveDevice({ id: 'test', host: 'test', hostname: 'localhost', user: 'node' });
        assert.strictEqual(existsSync('/usr/bin/proj1'), false);
        assert.strictEqual(existsSync('/usr/bin/proj1_2'), false);
        await vscode.commands.executeCommand('erdev.deployProject');
        assert.strictEqual(
            existsSync(path.join(`${wsp.uri.fsPath}`, 'build', 'proj1_1.0.0_amd64.deb')),
            true,
        );
        assert.strictEqual(existsSync('/usr/bin/proj1'), true);
        assert.strictEqual(existsSync('/usr/bin/proj1_2'), true);
        return true;
    });

    test('deploy quick cmake project proj1 with ssh key', async () => {
        const wsp = getWorkspace('proj1');
        assert.notStrictEqual(wsp, undefined);
        await openWorkspaceFile(wsp, 'main.cpp');
        await vscode.commands.executeCommand('cmake.setKitByName', '__scanforkits__', wsp);
        await vscode.commands.executeCommand('cmake.setVariant', wsp, 'Debug');
        await vscode.commands.executeCommand('cmake.stop');
        const handle = await getExtensionHandle();
        const api = handle.exports as ErDevApi;
        api.setActiveDevice({
            id: 'test',
            host: 'test',
            hostname: 'localhost',
            user: 'node',
            identity: '/home/node/.ssh/id_rsa',
        });
        assert.strictEqual(existsSync('/usr/bin/proj1'), false);
        assert.strictEqual(existsSync('/usr/bin/proj1_2'), false);
        await vscode.commands.executeCommand('erdev.deployQuickProject');
        assert.strictEqual(
            existsSync(path.join(`${wsp.uri.fsPath}`, 'build', 'proj1_1.0.0_amd64.deb')),
            true,
        );
        assert.strictEqual(existsSync('/usr/bin/proj1'), true);
        assert.strictEqual(existsSync('/usr/bin/proj1_2'), true);
        return true;
    });

    test('deploy cmake project proj2', async () => {
        const wsp = getWorkspace('proj2');
        assert.notStrictEqual(wsp, undefined);
        await openWorkspaceFile(wsp, 'main.cpp');
        await vscode.commands.executeCommand('cmake.setKitByName', '__scanforkits__', wsp);
        await vscode.commands.executeCommand('cmake.setVariant', wsp, 'Debug');
        await vscode.commands.executeCommand('cmake.stop');
        const handle = await getExtensionHandle();
        const api = handle.exports as ErDevApi;
        api.setActiveDevice({ id: 'test', host: 'test', hostname: 'localhost', user: 'node' });
        assert.strictEqual(existsSync('/usr/bin/proj2'), false);
        await vscode.commands.executeCommand('erdev.deployProject');
        assert.strictEqual(
            existsSync(path.join(`${wsp.uri.fsPath}`, 'build', 'proj2_1.0.0_amd64.deb')),
            true,
        );
        assert.strictEqual(existsSync('/usr/bin/proj2'), true);
        return true;
    });

    test('deploy python project pyproj', async () => {
        const wsp = getWorkspace('pyproj');
        assert.notStrictEqual(wsp, undefined);
        await openWorkspaceFile(wsp, 'bin', 'pyproj');
        const handle = await getExtensionHandle();
        const api = handle.exports as ErDevApi;
        api.setActiveDevice({ id: 'test', host: 'test', hostname: 'localhost', user: 'node' });
        assert.strictEqual(existsSync('/usr/local/bin/pyproj'), false);
        await vscode.commands.executeCommand('erdev.deployProject');
        assert.strictEqual(existsSync(`${wsp.uri.fsPath}/dist/python3-pyproj_1.0.0_all.deb`), true);
        assert.strictEqual(existsSync('/usr/local/bin/pyproj'), true);
        return true;
    });

    test('deploy python project pyproj wheel', async () => {
        const wsp = getWorkspace('pyproj_wheel');
        assert.notStrictEqual(wsp, undefined);
        await openWorkspaceFile(wsp, 'bin', 'pyproj_wheel');
        const handle = await getExtensionHandle();
        const api = handle.exports as ErDevApi;
        api.setActiveDevice({ id: 'test', host: 'test', hostname: 'localhost', user: 'node' });
        assert.strictEqual(existsSync('/usr/local/bin/pyproj_wheel'), false);
        await vscode.commands.executeCommand('erdev.deployProject');
        assert.strictEqual(
            existsSync(`${wsp.uri.fsPath}/dist/pyproj_wheel-1.0.0-py3-none-any.whl`),
            true,
        );
        assert.strictEqual(existsSync('/usr/local/bin/pyproj_wheel'), true);
        return true;
    });

    test('debug launch cmake project proj2', async () => {
        const wsp = getWorkspace('proj2');
        assert.notStrictEqual(wsp, undefined);
        await openWorkspaceFile(wsp, 'main.cpp');
        await vscode.commands.executeCommand('cmake.setKitByName', '__scanforkits__', wsp);
        await vscode.commands.executeCommand('cmake.setVariant', wsp, 'Debug');
        await vscode.commands.executeCommand('cmake.stop');
        const handle = await getExtensionHandle();
        const api = handle.exports as ErDevApi;
        api.setActiveDevice({ id: 'test', host: 'test', hostname: 'localhost', user: 'node' });
        await vscode.commands.executeCommand('erdev.deployProject');

        const br = new vscode.FunctionBreakpoint('main', true);
        vscode.debug.addBreakpoints([br]);

        const dbgPromise = new Promise<vscode.DebugSession>((res, rej) => {
            let disp = vscode.debug.onDidStartDebugSession((s) => {
                res(s);
                disp.dispose();
            });
        });

        await vscode.commands.executeCommand('erdev.launchProjectExe');
        const dbgsession = await dbgPromise;
        const endSession = new Promise<vscode.DebugSession>((res, rej) => {
            let disp = vscode.debug.onDidTerminateDebugSession((s) => {
                if (dbgsession === s) {
                    res(s);
                    disp.dispose();
                }
            });
        });
        // NOTE: this wait has to be here, as there's no event we can listen for
        // DebugSessionStarted event fires before the actual debugger is launched
        await delay(5000);
        await vscode.debug.activeDebugSession?.customRequest('continue', { singleThread: false });
        await endSession;
        return true;
    });

    test('debug attach cmake project proj1_2', async () => {
        const wsp = getWorkspace('proj1');
        assert.notStrictEqual(wsp, undefined);
        await openWorkspaceFile(wsp, 'main2.cpp');
        await vscode.commands.executeCommand('cmake.setKitByName', '__scanforkits__', wsp);
        await vscode.commands.executeCommand('cmake.setVariant', wsp, 'Debug');
        await vscode.commands.executeCommand('cmake.stop');
        const handle = await getExtensionHandle();
        const api = handle.exports as ErDevApi;
        api.setActiveDevice({ id: 'test', host: 'test', hostname: 'localhost', user: 'node' });
        await vscode.commands.executeCommand('erdev.deployProject');
        const childProcess = spawn('proj1_2', { detached: true });
        const pid = childProcess.pid;
        childProcess.unref();
        assert.strictEqual(typeof pid, 'number');
        const br = new vscode.SourceBreakpoint(
            {
                uri: projectFilePath(wsp, 'main2.cpp'),
                range: new vscode.Range(9, 1, 9, 1),
            },
            true,
        );
        vscode.debug.addBreakpoints([br]);

        const dbgPromise = new Promise<vscode.DebugSession>((res, rej) => {
            let disp = vscode.debug.onDidStartDebugSession((s) => {
                res(s);
                disp.dispose();
            });
        });
        const quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves({
            label: 'proj1_2',
            description: `pid=${pid}, cmd=proj1_2`,
            pid: pid,
            args: ['proj1_2'],
            executable: 'proj1_2',
        } as vscode.QuickPickItem);
        await vscode.commands.executeCommand('erdev.remoteAttach');
        quickPickStub.restore();

        const dbgsession = await dbgPromise;
        const endSession = new Promise<vscode.DebugSession>((res, rej) => {
            let disp = vscode.debug.onDidTerminateDebugSession((s) => {
                if (dbgsession === s) {
                    res(s);
                    disp.dispose();
                }
            });
        });
        // NOTE: this wait has to be here, as there's no event we can listen for
        // DebugSessionStarted event fires before the actual debugger is launched
        await delay(5000);
        await vscode.debug.activeDebugSession?.customRequest('continue', { singleThread: false });
        await delay(1000);
        await vscode.debug.activeDebugSession?.customRequest('continue', { singleThread: false });
        await delay(1000);
        await vscode.debug.activeDebugSession?.customRequest('disconnect', { singleThread: false });
        await endSession;
        return true;
    });

    test('debug launch python project', async () => {
        const wsp = getWorkspace('pyproj');
        assert.notStrictEqual(wsp, undefined);
        await openWorkspaceFile(wsp, 'bin', 'pyproj');
        const handle = await getExtensionHandle();
        const api = handle.exports as ErDevApi;
        api.setActiveDevice({ id: 'test', host: 'test', hostname: 'localhost', user: 'node' });
        await vscode.commands.executeCommand('erdev.deployProject');

        const br = new vscode.SourceBreakpoint(
            new vscode.Location(projectFilePath(wsp, 'bin', 'pyproj'), new vscode.Position(5, 0)),
            true,
        );
        vscode.debug.addBreakpoints([br]);

        const dbgPromise = new Promise<vscode.DebugSession>((res, rej) => {
            let disp = vscode.debug.onDidStartDebugSession((s) => {
                res(s);
                disp.dispose();
            });
        });

        await vscode.commands.executeCommand('erdev.launchProjectExe');
        const dbgsession = await dbgPromise;
        const endSession = new Promise<vscode.DebugSession>((res, rej) => {
            let disp = vscode.debug.onDidTerminateDebugSession((s) => {
                if (dbgsession === s) {
                    res(s);
                    disp.dispose();
                }
            });
        });
        // NOTE: this wait has to be here, as there's no event we can listen for
        // DebugSessionStarted event fires before the actual debugger is launched
        await delay(5000);
        await vscode.debug.activeDebugSession?.customRequest('continue', { singleThread: false });
        await endSession;
        return true;
    });

    test('debug attach python project', async () => {
        const wsp = getWorkspace('pyproj_wheel');
        assert.notStrictEqual(wsp, undefined);
        await openWorkspaceFile(wsp, 'bin', 'pyproj_wheel');
        const handle = await getExtensionHandle();
        const api = handle.exports as ErDevApi;
        api.setActiveDevice({ id: 'test', host: 'test', hostname: 'localhost', user: 'node' });
        await vscode.commands.executeCommand('erdev.deployProject');
        const childProcess = spawn('pyproj_wheel', { detached: true });
        const pid = childProcess.pid;
        childProcess.unref();
        assert.strictEqual(typeof pid, 'number');
        const br = new vscode.SourceBreakpoint(
            {
                uri: projectFilePath(wsp, 'bin', 'pyproj_wheel'),
                range: new vscode.Range(7, 1, 7, 1),
            },
            true,
        );
        vscode.debug.addBreakpoints([br]);

        const dbgPromise = new Promise<vscode.DebugSession>((res, rej) => {
            let disp = vscode.debug.onDidStartDebugSession((s) => {
                res(s);
                disp.dispose();
            });
        });
        const quickPickStub = sinon.stub(vscode.window, 'showQuickPick').resolves({
            label: 'pyproj_wheel',
            description: `pid=${pid}, cmd=pyproj_wheel`,
            pid: pid,
            args: ['pyproj_wheel'],
            executable: '/usr/bin/python3',
        } as vscode.QuickPickItem);
        await vscode.commands.executeCommand('erdev.remoteAttach');
        quickPickStub.restore();

        const dbgsession = await dbgPromise;
        const endSession = new Promise<vscode.DebugSession>((res, rej) => {
            let disp = vscode.debug.onDidTerminateDebugSession((s) => {
                if (dbgsession === s) {
                    res(s);
                    disp.dispose();
                }
            });
        });
        // NOTE: this wait has to be here, as there's no event we can listen for
        // DebugSessionStarted event fires before the actual debugger is launched
        await delay(5000);
        await vscode.debug.activeDebugSession?.customRequest('continue', { singleThread: false });
        await delay(1000);
        await vscode.debug.activeDebugSession?.customRequest('continue', { singleThread: false });
        await delay(1000);
        await vscode.debug.activeDebugSession?.customRequest('disconnect', { singleThread: false });
        await endSession;
        return true;
    });
});
