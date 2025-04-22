// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import { LRUCache } from 'lru-cache';

export class ArgsPick {
    private static cache = new LRUCache<string, string>({ max: 10 });
    private input?: string;
    private pick: vscode.QuickPick<vscode.QuickPickItem>;
    private pick_input: Promise<vscode.QuickPickItem | undefined>;
    private static enabled = true;
    constructor() {
        let options: vscode.QuickPickItem[] = [];
        ArgsPick.cache.forEach((value, key) => {
            options.push({ label: key });
        });
        this.pick = vscode.window.createQuickPick<vscode.QuickPickItem>();
        this.pick.title = 'Specify an argument for debug launch';
        this.pick.placeholder = 'Select an argument or type a new one';
        let value_disp = this.pick.onDidChangeValue((value) => {
            this.input = value;
        });
        this.pick_input = new Promise((resolve) => {
            let disposable = this.pick.onDidAccept(() => {
                resolve(this.pick.selectedItems[0]);
                disposable.dispose();
                value_disp.dispose();
            });
        });
        this.pick.ignoreFocusOut = true;
        options.unshift({ label: '<no args>', description: 'default' });
        this.pick.items = options;
    }
    public async show(): Promise<string[]> {
        let accept = await ArgsPick.get_pick_result(this.pick, this.pick_input);
        this.pick.dispose();
        let result = '';
        if (accept === undefined) {
            result = this.input || '';
        } else if (accept.label !== '<no args>') {
            result = accept.label;
        }
        if (result !== '') {
            ArgsPick.cache.set(result, result);
        }
        return result.split(' ').filter((value) => value.trim() !== '');
    }

    public static async get_pick_result(
        pick: vscode.QuickPick<vscode.QuickPickItem>,
        input: Promise<vscode.QuickPickItem | undefined>,
    ) {
        if (!ArgsPick.enabled) {
            return undefined;
        }
        pick.show();
        return await input;
    }
    public static enableArgsPick(force: boolean) {
        ArgsPick.enabled = force;
    }
}

export async function showArgsPick(): Promise<string[]> {
    let pick = new ArgsPick();
    return pick.show();
}
