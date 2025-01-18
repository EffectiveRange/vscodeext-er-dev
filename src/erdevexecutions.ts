// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import * as path from 'path';

import { ErDevSSHTreeDataProvider, ErDeviceItem } from './erdevproviders';
import { identityArgs, toHost } from './erdevmodel';
import { ErDeviceModel } from './api';
import { execShell, Executable } from './vscodeUtils';
import { ERExtension } from './erextension';

export type Program = string | number; // executable name or pid
export interface DebugLaunchContext {
    program: Program;
    execution?: vscode.TaskExecution;
    debugPort?: number;
    sessionId?: string;
}

export abstract class IErDevExecutions {
    private deploySshScriptPath: string;
    protected erext: ERExtension;
    get extension(): ERExtension {
        return this.erext;
    }
    constructor(ext: ERExtension) {
        let deploySshScriptUri = vscode.Uri.file(
            path.join(__dirname, '..', 'resources', 'scripts', 'deploy_ssh.sh'),
        );
        this.deploySshScriptPath = deploySshScriptUri.fsPath;
        this.erext = ext;
    }

    public abstract getPrograms(workspaceFolder: vscode.WorkspaceFolder): Promise<string[]>;

    public async packProject(
        workspaceFolder?: vscode.WorkspaceFolder,
    ): Promise<number | undefined | void> {
        if (workspaceFolder === undefined) {
            showNoWorkspaceWarning();
            return;
        }
        let packScriptUri = vscode.Uri.file(
            path.join(__dirname, '..', 'resources', 'scripts', 'pack.sh'),
        );
        return this.buildProject(workspaceFolder)
            .then((exec) =>
                execShell(
                    this.erext.logChannel,
                    workspaceFolder,
                    'Pack Project',
                    packScriptUri.fsPath,
                    this.packScriptName(workspaceFolder) as string,
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
        fullPath?: boolean,
    ): Promise<Executable | undefined>;

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
        const exe = await this.selectExecutable(workspaceFolder, false);
        const activeDevice = await setActiveDeviceIfMissing(
            this.erext.logChannel,
            provider,
            device,
        );
        if (exe === undefined) {
            vscode.window.showWarningMessage('No launch target selected!');
            return Promise.resolve();
        }
        let exec = await this.setupRemoteDebugger(workspaceFolder, activeDevice, {
            program: exe.label,
        });
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
            this.erext.logChannel.error(`Failed to launch debug target:${error}`);
            this.cleanupRemoteDebugger(workspaceFolder, activeDevice, exec);
            return Promise.reject(error);
        }
    }

    ///////////////////////
    public async deployProject(
        provider: ErDevSSHTreeDataProvider,
        target?: ErDeviceModel,
        workspaceFolder?: vscode.WorkspaceFolder,
        quick: boolean = false,
    ): Promise<void> {
        if (workspaceFolder === undefined) {
            showNoWorkspaceWarning();
            this.erext.logChannel.warn('No workspace found when initiating deploy');
            return Promise.resolve();
        }
        return this.buildProject(workspaceFolder)
            .then(() => setActiveDeviceIfMissing(this.erext.logChannel, provider, target))
            .then(async (activeTarget) => {
                const res = await this.execDeploy(activeTarget, workspaceFolder, quick);
                if (res !== 0) {
                    this.erext.logChannel.error('Deployment failed!');
                }
            });
    }

    private async execDeploy(
        target: ErDeviceModel,
        workspaceFolder: vscode.WorkspaceFolder,
        quick: boolean = false,
    ): Promise<number | void> {
        const packScript = this.packScriptName(workspaceFolder);
        if (packScript === undefined) {
            this.erext.logChannel.error('Cannot pack if pack script name is not supplied');
            return Promise.resolve();
        }
        const [exec, res] = await execShell(
            this.erext.logChannel,
            workspaceFolder,
            'Deploy Project',
            this.deploySshScriptPath,
            packScript,
            workspaceFolder.uri.fsPath,
            quick ? 'quick' : 'all',
            toHost(target),
            ...identityArgs(target),
        );
        return res;
    }
}

export async function setActiveDeviceIfMissing(
    log: vscode.LogOutputChannel,
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
        log.debug(`Active device is not set,candidates ${available}`);
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
    log.debug(`Resolved active device name is ${target.host}`);

    return target;
}

export abstract class IERDeviceExecution {
    protected erext: ERExtension;
    get extension() {
        return this.erext;
    }
    constructor(ext: ERExtension) {
        this.erext = ext;
    }
    public abstract launchTerminal(
        provider: ErDevSSHTreeDataProvider,
        device?: ErDeviceModel,
    ): Promise<vscode.Terminal | void>;
}

export class SSHDeviceExecution extends IERDeviceExecution {
    constructor(ext: ERExtension) {
        super(ext);
    }
    public async launchTerminal(
        provider: ErDevSSHTreeDataProvider,
        device?: ErDeviceModel,
    ): Promise<vscode.Terminal | void> {
        return setActiveDeviceIfMissing(this.erext.logChannel, provider, device).then((dev) => {
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
