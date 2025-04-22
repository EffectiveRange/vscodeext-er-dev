// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import { ErDevSSHTreeDataProvider, ErDeviceItem } from './erdevproviders';
import { ErExtensionModel } from './erdevmodel';
import { getActiveWorkspace } from './vscodeUtils';
import { DispatchExecution } from './executiondispatch';
import { SSHDeviceExecution } from './erdevexecutions';
import { ErDevApi } from './api';
import { ERExtension } from './erextension';
import { ArgsPick } from './argspick';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): ErDevApi {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    let erExt = new ERExtension();
    let model = new ErExtensionModel(erExt);
    let erExec = new DispatchExecution(erExt);
    let deviceExec = new SSHDeviceExecution(erExt);
    let erProvider = new ErDevSSHTreeDataProvider(model);

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('erdev.sshconfig')) {
                erProvider.refresh();
            }
        }),
    );
    const erDevSSHExplorer = vscode.window.createTreeView('er-ssh-explorer', {
        treeDataProvider: erProvider,
        canSelectMany: false,
    });

    context.subscriptions.push(
        erDevSSHExplorer.onDidChangeSelection((e) => {
            model.setActiveDevice(
                e.selection.length === 1 ? (e.selection[0] as ErDeviceItem).model : undefined,
            );
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('er-ssh-explorer.refresh', () => erProvider.refresh()),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('er-ssh-explorer.deployProject', (device: ErDeviceItem) =>
            erExec.deployProject(erProvider, device.model, getActiveWorkspace()),
        ),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'er-ssh-explorer.deployQuickProject',
            (device: ErDeviceItem) =>
                erExec.deployProject(erProvider, device.model, getActiveWorkspace(), true),
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'er-ssh-explorer.launchProjectExe',
            (device: ErDeviceItem) =>
                erExec.launchTargetDebug(erProvider, getActiveWorkspace(), device.model),
        ),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('er-ssh-explorer.remoteAttach', (device: ErDeviceItem) =>
            erExec.attachTargetDebug(erProvider, getActiveWorkspace(), device.model),
        ),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('er-ssh-explorer.terminal', (device: ErDeviceItem) =>
            deviceExec.launchTerminal(erProvider, device.model),
        ),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('erdev.terminal', () =>
            deviceExec.launchTerminal(erProvider),
        ),
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('erdev.pickProgram', () =>
            erExec.pickProgram(getActiveWorkspace()),
        ),
    );
    context.subscriptions.push(erDevSSHExplorer);

    // status bar item for packaging
    createErStatusSeparator(context, model, erExec);

    createPackStatusBarItem(context, model, erExec);

    createDeployStatusBarItem(context, erProvider, erExec);

    createDeployStatusBarItem(context, erProvider, erExec, true);

    createLaunchStatusBarItem(context, erProvider, erExec);

    createAttachStatusBarItem(context, erProvider, erExec);
    // TODO items:

    // remote debug attach (C++, python)
    return {
        setActiveDevice: (m) => {
            model.setActiveDevice(m);
        },
        enableArgsPick: (enable) => {
            ArgsPick.enableArgsPick(enable);
        },
    };
}

function createErStatusSeparator(
    context: vscode.ExtensionContext,
    model: ErExtensionModel,
    erExec: DispatchExecution,
) {
    let erStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 101);
    erStatusBar.text = '$(er-crosshair)';
    context.subscriptions.push(erStatusBar);
    erStatusBar.show();
}

function createPackStatusBarItem(
    context: vscode.ExtensionContext,
    model: ErExtensionModel,
    erExec: DispatchExecution,
) {
    let erStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    erStatusBar.command = 'erdev.packProject';
    setPackStatusText(erStatusBar);
    context.subscriptions.push(erStatusBar);
    context.subscriptions.push(
        vscode.commands.registerCommand('erdev.packProject', () =>
            erExec.packProject(getActiveWorkspace()),
        ),
    );
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((e) => {
            setPackStatusText(erStatusBar);
        }),
    );

    erStatusBar.show();
}

function createDeployStatusBarItem(
    context: vscode.ExtensionContext,
    provider: ErDevSSHTreeDataProvider,
    erExec: DispatchExecution,
    quick: boolean = false,
) {
    let erStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    const deployCmd = quick ? 'erdev.deployQuickProject' : 'erdev.deployProject';
    erStatusBar.command = deployCmd;
    const deployStatusFunc = quick ? setQuickDeployStatusText : setDeployStatusText;
    deployStatusFunc(provider.model, erStatusBar);
    context.subscriptions.push(erStatusBar);
    context.subscriptions.push(
        vscode.commands.registerCommand(deployCmd, () =>
            erExec.deployProject(
                provider,
                provider.model.getActiveDevice(),
                getActiveWorkspace(),
                quick,
            ),
        ),
    );
    context.subscriptions.push(
        provider.model.onChangeActiveDevices(() => deployStatusFunc(provider.model, erStatusBar)),
    );

    erStatusBar.show();
}

function createLaunchStatusBarItem(
    context: vscode.ExtensionContext,
    provider: ErDevSSHTreeDataProvider,
    erExec: DispatchExecution,
) {
    let erStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    erStatusBar.command = 'erdev.launchProjectExe';
    setLaunchStatusText(provider.model, erStatusBar);
    context.subscriptions.push(erStatusBar);
    context.subscriptions.push(
        vscode.commands.registerCommand('erdev.launchProjectExe', () =>
            erExec.launchTargetDebug(
                provider,
                getActiveWorkspace(),
                provider.model.getActiveDevice(),
            ),
        ),
    );
    erStatusBar.show();
}

function createAttachStatusBarItem(
    context: vscode.ExtensionContext,
    provider: ErDevSSHTreeDataProvider,
    erExec: DispatchExecution,
) {
    let erStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 97);
    erStatusBar.command = 'erdev.remoteAttach';
    setAttachStatusText(provider.model, erStatusBar);
    context.subscriptions.push(erStatusBar);
    context.subscriptions.push(
        vscode.commands.registerCommand('erdev.remoteAttach', () =>
            erExec.attachTargetDebug(
                provider,
                getActiveWorkspace(),
                provider.model.getActiveDevice(),
            ),
        ),
    );
    erStatusBar.show();
}

function setPackStatusText(erStatusBar: vscode.StatusBarItem) {
    const wsp = getActiveWorkspace()?.name ?? '';
    erStatusBar.text = '$(package) Pack';
    erStatusBar.tooltip = `Pack artifacts of workspace [${wsp}]`;
}

function setDeployStatusText(model: ErExtensionModel, erStatusBar: vscode.StatusBarItem) {
    erStatusBar.text = '$(cloud-upload) Deploy';
    erStatusBar.tooltip = `Deploy current project package to device(s)\
    [${model.getActiveDeviceName() ?? 'None'}]`;
}

function setQuickDeployStatusText(model: ErExtensionModel, erStatusBar: vscode.StatusBarItem) {
    erStatusBar.text = '$(zap) Quick-Deploy';
    erStatusBar.tooltip = `Quick-Deploy (no dependency install) current project package to \
    device(s)[${model.getActiveDeviceName() ?? 'None'}]`;
}

function setLaunchStatusText(model: ErExtensionModel, erStatusBar: vscode.StatusBarItem) {
    erStatusBar.text = '$(debug-alt) Launch';
}

function setAttachStatusText(model: ErExtensionModel, erStatusBar: vscode.StatusBarItem) {
    erStatusBar.text = '$(debug-console) Attach';
}

// This method is called when your extension is deactivated
export function deactivate() {}
