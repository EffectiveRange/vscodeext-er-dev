// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import * as path from 'path';

import { ErDevSSHTreeDataProvider, ErDeviceItem } from './erdevproviders';
import { identityArgs, toHost } from './erdevmodel';
import { ErDeviceModel } from './api';
import { execShell } from './vscodeUtils';

export type Program = string | number; // executable name or pid
export interface DebugLaunchContext {
    program: Program;
    execution?: vscode.TaskExecution;
    debugPort?: number;
    sessionId?: string;
}

export abstract class IErDevExecutions {
    private deploySshScriptPath: string;
    constructor() {
        let deploySshScriptUri = vscode.Uri.file(
            path.join(__dirname, '..', 'resources', 'scripts', 'deploy_ssh.sh'),
        );
        this.deploySshScriptPath = deploySshScriptUri.fsPath;
    }

    public async packProject(
        workspaceFolder?: vscode.WorkspaceFolder,
    ): Promise<number | undefined | void> {
        if (workspaceFolder === undefined) {
            showNoWorkspaceWarning();
            return;
        }
        let packScriptUri = vscode.Uri.file(
            path.join(
                __dirname,
                '..',
                'resources',
                'scripts',
                `pack_${this.packScriptName(workspaceFolder)}.sh`,
            ),
        );
        return this.buildProject(workspaceFolder)
            .then((exec) =>
                execShell(
                    workspaceFolder,
                    'Pack Project',
                    packScriptUri.fsPath,
                    workspaceFolder.uri.fsPath,
                ),
            )
            .then((val) => val[1]);
    }

    public abstract buildProject(
        workspaceFolder?: vscode.WorkspaceFolder,
    ): Promise<vscode.TaskExecution | void>;

    public abstract packScriptName(workspaceFolder?: vscode.WorkspaceFolder): string | undefined;

    public abstract debugTargetToRemoteSshLaunchConfig(
        workspaceFolder: vscode.WorkspaceFolder,
        program: DebugLaunchContext,
        device: ErDeviceModel,
    ): Promise<vscode.DebugConfiguration>;

    public abstract selectExecutable(
        workspaceFolder: vscode.WorkspaceFolder,
    ): Promise<string | undefined>;

    public abstract setupRemoteDebugger(
        workspaceFolder: vscode.WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
    ): Promise<DebugLaunchContext>;

    public abstract cleanupRemoteDebugger(
        workspaceFolder: vscode.WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
    ): Promise<void>;

    public async launchTargetDebug(
        provider: ErDevSSHTreeDataProvider,
        workspaceFolder?: vscode.WorkspaceFolder,
        device?: ErDeviceModel,
    ): Promise<boolean | void> {
        if (workspaceFolder === undefined) {
            showNoWorkspaceWarning();
            return Promise.resolve();
        }
        const exe = await this.selectExecutable(workspaceFolder);
        const activeDevice = await setActiveDeviceIfMissing(provider, device);
        if (exe === undefined) {
            vscode.window.showWarningMessage('No launch target selected!');
            return Promise.resolve();
        }
        let exec = await this.setupRemoteDebugger(workspaceFolder, activeDevice, { program: exe });
        try {
            const dbgConfig = await this.debugTargetToRemoteSshLaunchConfig(
                workspaceFolder,
                exec,
                activeDevice,
            );
            const started = await vscode.debug.startDebugging(workspaceFolder, dbgConfig, {
                suppressDebugView: true,
            });

            if (!started) {
                await this.cleanupRemoteDebugger(workspaceFolder, activeDevice, exec);
                return;
            }
            const actSession = vscode.debug.activeDebugSession;
            let disposable = vscode.debug.onDidTerminateDebugSession((session) => {
                if (session === actSession) {
                    this.cleanupRemoteDebugger(workspaceFolder, activeDevice, exec);
                    disposable.dispose();
                }
            });
            return started;
        } catch (error) {
            console.log(error);
            this.cleanupRemoteDebugger(workspaceFolder, activeDevice, exec);
            return Promise.reject(error);
        }
    }

    ///////////////////////
    public async deployProject(
        provider: ErDevSSHTreeDataProvider,
        target?: ErDeviceModel,
        workspaceFolder?: vscode.WorkspaceFolder,
    ): Promise<void> {
        if (workspaceFolder === undefined) {
            showNoWorkspaceWarning();
            return Promise.resolve();
        }
        return this.buildProject(workspaceFolder)
            .then(() => setActiveDeviceIfMissing(provider, target))
            .then(async (activeTarget) => {
                const res = await this.execDeploy(activeTarget, workspaceFolder);
                console.assert(res === 0, 'Deployment failed');
            });
    }

    private async execDeploy(
        target: ErDeviceModel,
        workspaceFolder: vscode.WorkspaceFolder,
    ): Promise<number | void> {
        const packScript = this.packScriptName(workspaceFolder);
        if (packScript === undefined) {
            console.log('Cannot pack if pack script name is not supplied');
            return Promise.resolve();
        }
        const [exec, res] = await execShell(
            workspaceFolder,
            'Deploy Project',
            this.deploySshScriptPath,
            packScript,
            workspaceFolder.uri.fsPath,
            toHost(target),
            ...identityArgs(target),
        );
        return res;
    }
}

export async function setActiveDeviceIfMissing(
    provider: ErDevSSHTreeDataProvider,
    target?: ErDeviceModel,
): Promise<ErDeviceModel> {
    if (target === undefined) {
        const available = await provider.getChildren().then((items) =>
            items
                .filter((i) => (i as ErDeviceItem) !== undefined)
                .filter((i) => i.label !== undefined)
                .map((i) => (i as ErDeviceItem).asQuickPickItem()),
        );
        if (available.length === 1) {
            target = available[0].model;
        } else {
            const selected_target = await vscode.window.showQuickPick(available, {
                title: 'ER Device Selector',
                placeHolder: 'Select target devices',
                canPickMany: false,
            });
            target = selected_target?.model;
        }
        if (target === undefined) {
            return Promise.reject('Must select a device...');
        }
        provider.model.setActiveDevice(target);
    }
    return target;
}

export abstract class IERDeviceExecution {
    public abstract launchTerminal(
        provider: ErDevSSHTreeDataProvider,
        device?: ErDeviceModel,
    ): Promise<vscode.Terminal | void>;
}

export class SSHDeviceExecution extends IERDeviceExecution {
    public async launchTerminal(
        provider: ErDevSSHTreeDataProvider,
        device?: ErDeviceModel,
    ): Promise<vscode.Terminal | void> {
        return setActiveDeviceIfMissing(provider, device).then((dev) => {
            const term = vscode.window.createTerminal(`SSH:${dev.host}`, '/bin/bash', [
                '-c',
                'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null' +
                    ` -q ${identityArgs(dev).join(' ')} ${toHost(dev)}`,
            ]);
            term.show();
            return term;
        });
    }
}

export function showNoCmakeApiWarning() {
    vscode.window.showWarningMessage('CMake Tools API not available!!!');
}
function showNoTargetWarning() {
    vscode.window.showInformationMessage('No device selected for deployment');
}
export function showNoWorkspaceWarning() {
    vscode.window.showInformationMessage('No workspace folder is active');
}
