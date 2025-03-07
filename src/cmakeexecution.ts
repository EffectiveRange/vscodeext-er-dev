// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import * as cmake from 'vscode-cmake-tools';
import { DebugLaunchContext, IErDevExecutions } from './erdevexecutions';
import { showNoCmakeApiWarning } from './erdevexecutions';
import { Executable, showExecQuickPick } from './vscodeUtils';
import { ErDeviceModel } from './api';
import { identityArgs, toHost } from './erdevmodel';
import { ERExtension } from './erextension';

export class CmakeExecutions extends IErDevExecutions {
    public getPrograms(workspaceFolder: vscode.WorkspaceFolder): Promise<string[]> {
        throw new Error('Method not implemented.');
    }
    constructor(ext: ERExtension) {
        super(ext);
    }

    public async cleanupRemoteDebugger(
        workspaceFolder: vscode.WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
    ): Promise<void> {}

    public async setupRemoteDebugger(
        workspaceFolder: vscode.WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
        attach?: boolean,
    ): Promise<DebugLaunchContext> {
        return context;
    }

    public packScriptName(workspaceFolder?: vscode.WorkspaceFolder): string {
        return 'cmake';
    }

    public async buildProject(workspaceFolder: vscode.WorkspaceFolder): Promise<void | undefined> {
        return withCmake((api) =>
            api
                .getProject(workspaceFolder.uri)
                .then((project) =>
                    Promise.all([Promise.resolve(project), project?.configure()]).then((pp) =>
                        pp[0]?.build(),
                    ),
                ),
        );
    }

    public async selectExecutable(
        workspaceFolder: vscode.WorkspaceFolder,
        fullPath?: boolean,
    ): Promise<Executable | undefined> {
        return withCmake((api) =>
            api
                .getProject(workspaceFolder.uri)
                .then((p) => Promise.all([Promise.resolve(p), p?.configure()]))
                .then((pv) => {
                    const dbgTargets = cmakeProjectToDebugTargets(pv[0]);

                    if (dbgTargets?.length === 1) {
                        return Promise.resolve({
                            label: dbgTargets[0].target.fullName ?? dbgTargets[0].target.name,
                            description:
                                dbgTargets[0].target.artifacts?.[0] ?? dbgTargets[0].target.name,
                        });
                    }
                    const items =
                        dbgTargets?.map((t) => {
                            return {
                                label: t.target.fullName ?? t.target.name,
                                description: t.target.artifacts?.[0] ?? t.target.name,
                            };
                        }) ?? [];
                    if (items.length === 0) {
                        return Promise.resolve(undefined);
                    }
                    return showExecQuickPick(items);
                }),
        );
    }

    public async debugTargetToRemoteSshLaunchConfig(
        workspaceFolder: vscode.WorkspaceFolder,
        program: DebugLaunchContext,
        device: ErDeviceModel,
    ): Promise<vscode.DebugConfiguration> {
        return {
            type: 'cppdbg',
            name: `ErDev: Launch "${program}"`,
            request: 'launch',
            program: `${program.program}`,
            args: program.args ?? [],
            stopAtEntry: true,
            cwd: '/',
            environment: [],
            externalConsole: false,
            pipeTransport: {
                pipeCwd: '/usr/bin',
                pipeProgram: '/usr/bin/ssh',
                pipeArgs: [
                    '-o',
                    'StrictHostKeyChecking=no',
                    '-o',
                    'UserKnownHostsFile=/dev/null',
                    '-q',
                    ...identityArgs(device),
                    toHost(device),
                ],
                debuggerPath: 'sudo /usr/bin/gdb',
            },
            linux: {
                MIMode: 'gdb',
                setupCommands: [
                    {
                        description: 'Enable pretty-printing for gdb',
                        text: '-enable-pretty-printing',
                        ignoreFailures: true,
                    },
                ],
            },
        };
    }
    public debugTargetToRemoteSshAttachConfig(
        workspaceFolder: vscode.WorkspaceFolder,
        program: DebugLaunchContext,
        device: ErDeviceModel,
    ): Promise<vscode.DebugConfiguration> {
        return Promise.resolve({
            type: 'cppdbg',
            name: `ErDev: Launch "${program}"`,
            request: 'attach',
            processId: `${program.program as number}`,
            program: `${program.process?.executable}`,
            args: [],
            stopAtEntry: true,
            cwd: '/',
            environment: [],
            externalConsole: false,
            pipeTransport: {
                pipeCwd: '/usr/bin',
                pipeProgram: '/usr/bin/ssh',
                pipeArgs: [
                    '-o',
                    'StrictHostKeyChecking=no',
                    '-o',
                    'UserKnownHostsFile=/dev/null',
                    '-q',
                    ...identityArgs(device),
                    toHost(device),
                ],
                debuggerPath: 'sudo /usr/bin/gdb',
            },
            linux: {
                MIMode: 'gdb',
                setupCommands: [
                    {
                        description: 'Enable pretty-printing for gdb',
                        text: '-enable-pretty-printing',
                        ignoreFailures: true,
                    },
                ],
            },
        });
    }
}

interface CmakeProjectExecTarget {
    project: cmake.CodeModel.Project;
    target: cmake.CodeModel.Target;
}
function cmakeProjectToDebugTargets(
    project?: cmake.Project,
    cmakeConfigName?: string,
): CmakeProjectExecTarget[] | undefined {
    const projects = project?.codeModel?.configurations[0].projects;
    const projectTargets = projects?.map((p) => {
        return { project: p, targets: p.targets };
    });
    const projectExecTargets = projectTargets?.map((pt) => {
        return { project: pt.project, execs: pt.targets.filter((t) => t.type === 'EXECUTABLE') };
    });
    return projectExecTargets?.flatMap((pet) =>
        pet.execs.map((target) => {
            return { project: pet.project, target: target };
        }),
    );
}

async function withCmake<T>(
    func: (api: cmake.CMakeToolsApi) => Promise<T>,
): Promise<T | undefined> {
    const api = await cmake.getCMakeToolsApi(cmake.Version.latest);
    if (api) {
        return func(api);
    }
    showNoCmakeApiWarning();
    return Promise.resolve(undefined);
}
