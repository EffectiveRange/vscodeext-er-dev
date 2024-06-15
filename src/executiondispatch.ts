// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import { WorkspaceFolder, TaskExecution, DebugConfiguration } from 'vscode';
import { DebugLaunchContext, IErDevExecutions } from './erdevexecutions';
import { existsSync, fstat } from 'fs';
import { PythonExecution } from './pythonexecution';
import { CmakeExecutions } from './cmakeexecution';
import { ErDeviceModel } from './api';

class NoExecution extends IErDevExecutions {
    public async cleanupRemoteDebugger(
        workspaceFolder: WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
    ): Promise<void> {}

    public async setupRemoteDebugger(
        workspaceFolder: WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
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
    public selectExecutable(workspaceFolder: WorkspaceFolder): Promise<string | undefined> {
        return Promise.reject('Method not implemented.');
    }
    public buildProject(
        workspaceFolder?: WorkspaceFolder | undefined,
    ): Promise<void | TaskExecution> {
        return Promise.resolve();
    }
    public packScriptName(): string {
        throw new Error('Cannot deploy.');
    }
}

export class DispatchExecution extends IErDevExecutions {
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
    public setupRemoteDebugger(
        workspaceFolder: WorkspaceFolder,
        device: ErDeviceModel,
        context: DebugLaunchContext,
    ): Promise<DebugLaunchContext> {
        return this.getActiveExecution(workspaceFolder).setupRemoteDebugger(
            workspaceFolder,
            device,
            context,
        );
    }
    private cmakeExec: CmakeExecutions;
    private pythonExec: PythonExecution;
    private noExec: NoExecution;
    constructor() {
        super();
        this.cmakeExec = new CmakeExecutions();
        this.pythonExec = new PythonExecution();
        this.noExec = new NoExecution();
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

    public selectExecutable(workspaceFolder: WorkspaceFolder): Promise<string | undefined> {
        return this.getActiveExecution(workspaceFolder).selectExecutable(workspaceFolder);
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
        console.log(`Unhandled execution type for wsp:${wsp.name}`);
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
