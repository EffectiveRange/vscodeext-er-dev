// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import * as path from 'path';
import { Shescape } from 'shescape';
import { identityArgs, toHost } from './erdevmodel';
import { ErDeviceModel } from './api';
import { v4 } from 'uuid';
import { readFile } from 'fs';

const shescape = new Shescape({ shell: 'bash' });

export function getActiveWorkspace(): vscode.WorkspaceFolder | undefined {
    if (vscode.window.activeTextEditor) {
        const actPath = vscode.window.activeTextEditor.document.uri.fsPath;
        for (const [index, wsFolder] of vscode.workspace.workspaceFolders!.entries()) {
            const relative = path.relative(wsFolder.uri.fsPath, actPath);
            if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
                return wsFolder;
            }
        }
    }
    return vscode.workspace.workspaceFolders?.[0];
}

export interface Executable {
    label: string;
    description: string;
}

export async function showExecQuickPick(items: Executable[]): Promise<Executable | undefined> {
    return vscode.window.showQuickPick(items, {
        title: 'ER Dev Launch Selector',
        placeHolder: 'Select executable to launch',
        canPickMany: false,
    });
}

export async function execShell(
    channel: vscode.LogOutputChannel,
    wsp: vscode.WorkspaceFolder,
    name: string,
    command: string,
    ...args: string[]
): Promise<[vscode.TaskExecution, Promise<number | undefined>]> {
    let exec = new vscode.ShellExecution(command, args, {
        executable: '/bin/bash',
        shellArgs: ['-c'],
    });
    channel.info(`Creating Shell execution ${command} ${args}`);
    let task = new vscode.Task(
        {
            type: 'shell',
            isBackground: true,
            presentation: {
                reveal: 'never',
            },
        },
        wsp,
        name,
        'erdev',
        exec,
    );
    try {
        let exec = await vscode.tasks.executeTask(task);
        const execPromise = new Promise<number | undefined>((resolve, _) => {
            let disposable = vscode.tasks.onDidEndTaskProcess(async (event) => {
                if (event.execution.task === task) {
                    resolve(event.exitCode);
                    disposable.dispose();
                }
            });
        });
        return [exec, execPromise];
    } catch (e) {
        const error = e as Error;
        return Promise.reject(error.message);
    }
}

interface ShellExecResult {
    exitCode?: number;
    stdout: string | Error;
    stderr: string | Error;
}
export async function execShellWithOutput(
    output: vscode.LogOutputChannel,
    wsp: vscode.WorkspaceFolder,
    name: string,
    command: string,
    ...args: string[]
): Promise<ShellExecResult> {
    const sessionid = v4();
    const [exec, res] = await execShell(
        output,
        wsp,
        name,
        command,
        ...args,
        '2>',
        `/tmp/${sessionid}.stderr`,
        '>',
        `/tmp/${sessionid}.stdout`,
    );

    function readOutput(filename: string) {
        return new Promise<string | Error>((resolve, reject) => {
            readFile(filename, (err, data) => {
                if (err !== null) {
                    resolve(err);
                } else {
                    resolve(data.toString());
                }
            });
        });
    }
    const exitCode = await res;
    let outpromise = readOutput(`/tmp/${sessionid}.stdout`);
    let errpromise = readOutput(`/tmp/${sessionid}.stdout`);
    const [stdout, stderr] = await Promise.all([outpromise, errpromise]);

    return { exitCode, stdout, stderr };
}

export async function sshTask(
    output: vscode.LogOutputChannel,
    wsp: vscode.WorkspaceFolder,
    device: ErDeviceModel,
    command: string,
    ...args: string[]
): Promise<[vscode.TaskExecution, Promise<number | undefined>]> {
    const remoteCmd = `${command} ${args.join(' ')}`;
    return execShell(
        output,
        wsp,
        `Remote Exec:${device}`,
        'ssh',
        '-t',
        '-t',
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-q',
        ...identityArgs(device),
        toHost(device),
        shescape.quote(remoteCmd),
    );
}

export async function sshExecWithOutput(
    output: vscode.LogOutputChannel,
    wsp: vscode.WorkspaceFolder,
    device: ErDeviceModel,
    command: string,
    ...args: string[]
): Promise<ShellExecResult> {
    const remoteCmd = `${command} ${args.join(' ')}`;
    return execShellWithOutput(
        output,
        wsp,
        `Remote Exec:${device}`,
        'ssh',
        '-t',
        '-t',
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        '-q',
        ...identityArgs(device),
        toHost(device),
        shescape.quote(remoteCmd),
    );
}

export async function sshExec(
    output: vscode.LogOutputChannel,
    wsp: vscode.WorkspaceFolder,
    device: ErDeviceModel,
    command: string,
    ...args: string[]
): Promise<number | undefined> {
    const [exec, res] = await sshTask(output, wsp, device, command, ...args);
    return res;
}

export async function scpExec(
    output: vscode.LogOutputChannel,
    wsp: vscode.WorkspaceFolder,
    device: ErDeviceModel,
    target: string,
    ...source: string[]
) {
    const [exec, res] = await execShell(
        output,
        wsp,
        `Remote SCP:${device}`,
        'scp',
        '-o',
        'StrictHostKeyChecking=no',
        '-o',
        'UserKnownHostsFile=/dev/null',
        ...identityArgs(device),
        '-q',
        ...source,
        `${toHost(device)}:${target}`,
    );
    return res;
}
