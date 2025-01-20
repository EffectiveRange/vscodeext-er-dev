// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import { WorkspaceFolder, TaskExecution, DebugConfiguration, window } from 'vscode';
import { DebugLaunchContext, IErDevExecutions } from './erdevexecutions';
import { existsSync, fstat } from 'fs';
import { PythonExecution } from './pythonexecution';
import { CmakeExecutions } from './cmakeexecution';
import { ErDeviceModel } from './api';
import { ERExtension } from './erextension';
import { execShellWithOutput, Executable, sshExecWithOutput } from './vscodeUtils';

class NoExecution extends IErDevExecutions {
    public debugTargetToRemoteSshAttachConfig(
        workspaceFolder: WorkspaceFolder,
        program: DebugLaunchContext,
        device: ErDeviceModel,
    ): Promise<DebugConfiguration> {
        return Promise.reject('Method not implemented.');
    }
    public getPrograms(workspaceFolder: WorkspaceFolder): Promise<string[]> {
        return Promise.resolve([]);
    }
    constructor(ext: ERExtension) {
        super(ext);
    }
    public async cleanupRemoteDebugger(
        workspaceFolder: WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
    ): Promise<void> {}

    public async setupRemoteDebugger(
        workspaceFolder: WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
        attach?: boolean,
    ): Promise<DebugLaunchContext> {
        return context;
    }
    public async debugTargetToRemoteSshLaunchConfig(
        workspaceFolder: WorkspaceFolder,
        program: DebugLaunchContext,
        device: ErDeviceModel,
    ): Promise<DebugConfiguration> {
        return Promise.reject('Method not implemented.');
    }
    public selectExecutable(
        workspaceFolder: WorkspaceFolder,
        fullPath?: boolean,
    ): Promise<Executable | undefined> {
        return Promise.reject('Method not implemented.');
    }
    public buildProject(
        workspaceFolder?: WorkspaceFolder | undefined,
    ): Promise<void | TaskExecution> {
        return Promise.resolve();
    }
    public packScriptName(workspaceFolder?: WorkspaceFolder): string {
        throw new Error('Cannot deploy.');
    }
}

export class DispatchExecution extends IErDevExecutions {
    public debugTargetToRemoteSshAttachConfig(
        workspaceFolder: WorkspaceFolder,
        program: DebugLaunchContext,
        device: ErDeviceModel,
    ): Promise<DebugConfiguration> {
        return this.getActiveExecution(workspaceFolder).debugTargetToRemoteSshAttachConfig(
            workspaceFolder,
            program,
            device,
        );
    }
    public getPrograms(workspaceFolder: WorkspaceFolder): Promise<string[]> {
        return this.getActiveExecution(workspaceFolder).getPrograms(workspaceFolder);
    }
    public cleanupRemoteDebugger(
        workspaceFolder: WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
    ): Promise<void> {
        return this.getActiveExecution(workspaceFolder).cleanupRemoteDebugger(
            workspaceFolder,
            device,
            context,
        );
    }

    public pickProgram(workspaceFolder?: WorkspaceFolder): Promise<string | undefined> {
        if (workspaceFolder === undefined) {
            return Promise.resolve(undefined);
        }
        return this.getActiveExecution(workspaceFolder)
            .selectExecutable(workspaceFolder, true)
            .then((e) => e?.description);
    }

    public setupRemoteDebugger(
        workspaceFolder: WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
        attach?: boolean,
    ): Promise<DebugLaunchContext> {
        return this.getActiveExecution(workspaceFolder).setupRemoteDebugger(
            workspaceFolder,
            device,
            context,
            attach,
        );
    }
    private cmakeExec: CmakeExecutions;
    private pythonExec: PythonExecution;
    private noExec: NoExecution;
    constructor(ext: ERExtension) {
        super(ext);
        this.cmakeExec = new CmakeExecutions(ext);
        this.pythonExec = new PythonExecution(ext);
        this.noExec = new NoExecution(ext);
    }
    public async debugTargetToRemoteSshLaunchConfig(
        workspaceFolder: WorkspaceFolder,
        program: DebugLaunchContext,
        device: ErDeviceModel,
    ): Promise<DebugConfiguration> {
        return this.getActiveExecution(workspaceFolder).debugTargetToRemoteSshLaunchConfig(
            workspaceFolder,
            program,
            device,
        );
    }

    public selectExecutable(
        workspaceFolder: WorkspaceFolder,
        fullPath?: boolean,
    ): Promise<Executable | undefined> {
        return this.getActiveExecution(workspaceFolder).selectExecutable(workspaceFolder, fullPath);
    }

    private getActiveExecution(wsp?: WorkspaceFolder): IErDevExecutions {
        if (wsp === undefined) {
            return this.noExec;
        }

        if (existsSync(`${wsp.uri.fsPath}/CMakeLists.txt`)) {
            return this.cmakeExec;
        }
        if (existsSync(`${wsp.uri.fsPath}/setup.py`)) {
            return this.pythonExec;
        }
        this.erext.logChannel.error(`Unhandled execution type for wsp:${wsp.name}`);
        return this.noExec;
    }

    public buildProject(
        workspaceFolder?: WorkspaceFolder | undefined,
    ): Promise<void | TaskExecution> {
        return this.getActiveExecution(workspaceFolder).buildProject(workspaceFolder);
    }

    public packScriptName(workspaceFolder?: WorkspaceFolder) {
        return this.getActiveExecution(workspaceFolder).packScriptName(workspaceFolder);
    }
}
