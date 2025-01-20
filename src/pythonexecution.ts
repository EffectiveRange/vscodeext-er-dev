// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import { DebugLaunchContext, IErDevExecutions } from './erdevexecutions';
import path from 'path';
import { existsSync } from 'fs';
import {
    execShellWithOutput,
    Executable,
    scpExec,
    showExecQuickPick,
    sshExec,
    sshTask,
} from './vscodeUtils';
import { ErDeviceModel } from './api';
import { getRandomPort } from './utils';
import { v4 as uuidv4 } from 'uuid';
import { ERExtension } from './erextension';

export class PythonExecution extends IErDevExecutions {
    public getPrograms(workspaceFolder: vscode.WorkspaceFolder): Promise<string[]> {
        return Promise.reject('Method not implemented.');
    }
    public async cleanupRemoteDebugger(
        workspaceFolder: vscode.WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
    ): Promise<void> {
        if (context.sessionId === undefined) {
            return;
        }
        const res = await sshExec(
            this.erext.logChannel,
            workspaceFolder,
            device,
            'sudo',
            'kill',
            `$(cat /var/log/debugpy-${context.sessionId}.pid)`,
            '||',
            'true',
        );
        if (res !== 0) {
            vscode.window.showWarningMessage('Failed to clean up python debug session.');
        }
    }

    async launchSshTaskForDebugger(
        workspaceFolder: vscode.WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
        attach: boolean,
        port: number,
        sessionId: string,
    ): Promise<[vscode.TaskExecution, Promise<number | undefined>]> {
        if (attach === true) {
            return sshTask(
                this.erext.logChannel,
                workspaceFolder,
                device,
                'sudo',
                '/tmp/start_debugpy.sh',
                sessionId,
                port.toString(),
                //NOTE: the program path should be determined dynamically
                '--pid',
                `${context.program as number}`,
            );
        }
        let args = context.args ?? [];
        return sshTask(
            this.erext.logChannel,
            workspaceFolder,
            device,
            'sudo',
            '/tmp/start_debugpy.sh',
            sessionId,
            port.toString(),
            //NOTE: the program path should be determined dynamically
            '--wait-for-client',
            `/usr/local/bin/${context.program}`,
            ...args,
        );
    }

    public async setupRemoteDebugger(
        workspaceFolder: vscode.WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
        attach?: boolean,
    ): Promise<DebugLaunchContext> {
        await this.ensureDebugPyInstalled(workspaceFolder, device);
        const retryCount = 3;
        for (let i = 0; i < retryCount; i++) {
            const port = getRandomPort();
            const sessionId = uuidv4();
            let [exec, res] = await this.launchSshTaskForDebugger(
                workspaceFolder,
                device,
                context,
                attach === true,
                port,
                sessionId,
            );
            const code = await res;
            const addressInUseError = 75;
            if (code === 0) {
                return {
                    //NOTE: the program path should be determined dynamically
                    program:
                        attach === true ? context.program : `/usr/local/bin/${context.program}`,
                    execution: exec,
                    debugPort: port,
                    sessionId,
                };
            }
            if (addressInUseError !== code) {
                return Promise.reject(`Failed to start debugpy. Error code${code}`);
            }
        }

        return Promise.reject(`Failed to find open port for debugpy after ${retryCount} retries`);
    }
    private async ensureDebugPyInstalled(
        workspaceFolder: vscode.WorkspaceFolder,
        device: ErDeviceModel,
    ) {
        const checkPromise = sshExec(
            this.erext.logChannel,
            workspaceFolder,
            device,
            'python3',
            '-m',
            'debugpy',
            '--version',
        );
        const debugpyScriptUri = vscode.Uri.file(
            path.join(__dirname, '..', 'resources', 'scripts', 'start_debugpy.sh'),
        );
        const copyPromise = scpExec(
            this.erext.logChannel,
            workspaceFolder,
            device,
            '/tmp/',
            debugpyScriptUri.fsPath,
        );
        const [checkResult, copyResult] = await Promise.all([checkPromise, copyPromise]);

        if (checkResult !== 0) {
            const installExecResult = await sshExec(
                this.erext.logChannel,
                workspaceFolder,
                device,
                'sudo',
                'python3',
                '-m',
                'pip',
                'install',
                'debugpy',
            );
            if (installExecResult !== 0) {
                vscode.window.showWarningMessage(
                    `Could not install debugpy on device ${device.hostname}`,
                );
            }
        }
        if (copyResult !== 0) {
            vscode.window.showWarningMessage(
                `Could not copy debugpy launcher script to device ${device}`,
            );
        }
    }

    public async debugTargetToRemoteSshLaunchConfig(
        workspaceFolder: vscode.WorkspaceFolder,
        program: DebugLaunchContext,
        device: ErDeviceModel,
    ): Promise<vscode.DebugConfiguration> {
        const out = await execShellWithOutput(
            this.erext.logChannel,
            workspaceFolder,
            'Python package query',
            'python3',
            `${workspaceFolder.uri.fsPath}/setup.py`,
            '--name',
        );
        if (out.exitCode !== 0) {
            return Promise.reject(
                `Can't query package names for workspace ${workspaceFolder.name}`,
            );
        }
        const packageMappings = (out.stdout as string)
            .split('\n')
            .filter((l) => l.trim().length > 0)
            .map((pkgName) => {
                return {
                    localRoot: '${workspaceFolder}/'.concat(pkgName.trim()),
                    //NOTE: the python version should be factored out
                    remoteRoot: `/usr/local/lib/python3.9/dist-packages/${pkgName.trim()}`,
                };
            });
        return {
            name: `ErDev: Launch Python "${program}"`,
            type: 'debugpy',
            request: 'attach',
            connect: {
                host: device.hostname,
                port: program.debugPort,
            },
            justMyCode: false,
            stopOnEntry: true,

            pathMappings: [
                ...packageMappings,
                {
                    localRoot: '${workspaceFolder}/bin',
                    // NOTE: the remote exec dir should not be determined dynamically
                    remoteRoot: '/usr/local/bin',
                },
            ],
        };
    }

    public debugTargetToRemoteSshAttachConfig(
        workspaceFolder: vscode.WorkspaceFolder,
        program: DebugLaunchContext,
        device: ErDeviceModel,
    ): Promise<vscode.DebugConfiguration> {
        return this.debugTargetToRemoteSshLaunchConfig(workspaceFolder, program, device);
    }

    public async selectExecutable(
        workspaceFolder: vscode.WorkspaceFolder,
        fullPath?: boolean,
    ): Promise<Executable | undefined> {
        const bindir = [workspaceFolder.uri.fsPath, 'bin'].join(path.sep);
        if (!existsSync(bindir)) {
            return Promise.resolve(undefined);
        }
        const binfiles = await vscode.workspace.fs.readDirectory(vscode.Uri.file(bindir));
        const targets = binfiles.filter(
            (f) => f[1] in [vscode.FileType.File, vscode.FileType.SymbolicLink],
        );
        if (targets.length === 0) {
            return Promise.resolve(undefined);
        }
        if (targets.length === 1) {
            return Promise.resolve({
                label: targets[0][0],
                description: `${bindir}/${targets[0][0]}`,
            });
        }
        return showExecQuickPick(
            targets.map((t) => {
                return {
                    label: t[0][0],
                    description: `${bindir}/${t[0][0]}`,
                };
            }),
        );
    }

    private packCmd: string;

    constructor(ext: ERExtension) {
        super(ext);
        let packScriptUri = vscode.Uri.file(
            path.join(__dirname, '..', 'resources', 'scripts', 'pack_python'),
        );
        this.packCmd = packScriptUri.fsPath;
    }

    public buildProject(
        workspaceFolder?: vscode.WorkspaceFolder | undefined,
    ): Promise<void | vscode.TaskExecution> {
        return Promise.resolve();
    }

    public packScriptName(): string {
        return 'python';
    }
}
