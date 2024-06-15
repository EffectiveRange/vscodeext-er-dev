// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import * as sshparser from './utils';
import { ErExtensionModel } from './erdevmodel';
import { ErDeviceModel } from './api';

type Item = ErDeviceItem | ErErrorItem;
export class ErDevSSHTreeDataProvider implements vscode.TreeDataProvider<Item> {
    public readonly model: ErExtensionModel;
    constructor(model: ErExtensionModel) {
        this.model = model;
    }
    private _onDidChangeTreeData: vscode.EventEmitter<Item | undefined | null | void> =
        new vscode.EventEmitter<Item | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<Item | undefined | null | void> =
        this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ErDeviceItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ErDeviceItem): Thenable<Item[]> {
        let config = vscode.workspace.getConfiguration('erdev');
        let configfile = (config.get('sshconfig') as string) ?? '~/.ssh/config';
        let parser = new sshparser.SSHParser(configfile);
        if (parser.hasConfig()) {
            return Promise.resolve(
                parser.hosts().map(
                    (r) =>
                        new ErDeviceItem({
                            id: r.host,
                            host: r.host,
                            hostname: r.hostname,
                            user: r.user,
                            identity: r.identity,
                        }),
                ),
            );
        } else {
            return Promise.resolve([
                new ErErrorItem('No config file found', vscode.TreeItemCollapsibleState.None),
            ]);
        }
    }
}

export class ErDeviceQuickPickItem implements vscode.QuickPickItem {
    constructor(public readonly model: ErDeviceModel) {
        this.label = model.host;
        this.description = model.hostname;
    }
    label: string;
    kind?: vscode.QuickPickItemKind | undefined;
    iconPath?: vscode.ThemeIcon | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | undefined;
    description?: string | undefined;
    detail?: string | undefined;
    picked?: boolean | undefined;
    alwaysShow?: boolean | undefined;
    buttons?: readonly vscode.QuickInputButton[] | undefined;

    public asDevice() {
        return new ErDeviceItem(this.model);
    }
}

export class ErDeviceItem extends vscode.TreeItem {
    public get model(): ErDeviceModel {
        return this._model;
    }
    constructor(private readonly _model: ErDeviceModel) {
        super(_model.host, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'erdevice';
        this.tooltip = this._model.host;
    }

    asQuickPickItem(): ErDeviceQuickPickItem {
        return new ErDeviceQuickPickItem(this.model);
    }

    iconPath = new vscode.ThemeIcon('remote');
}

class ErErrorItem extends vscode.TreeItem {
    constructor(
        public readonly hint: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    ) {
        super(`<Error:${hint}>`, collapsibleState);
        this.tooltip = hint;
    }
    iconPath = new vscode.ThemeIcon('error');
}
