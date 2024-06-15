// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import { ErDeviceModel } from './api';

interface ErrorResult {
    code: number;
    error: string;
}
type ExecResult = ErrorResult | string;

export function identityArgs(model: ErDeviceModel): string[] {
    if (model.identity === undefined) {
        return [];
    }
    return ['-i', model.identity];
}

export function toHost(model: ErDeviceModel): string {
    const userStr = model.user !== undefined ? `${model.user}@` : '';
    return `${userStr}${model.hostname}`;
}

export function sshConfigToDeviceModel() {}

export class ErExtensionModel {
    private activeDevice?: ErDeviceModel;

    private changeEmitter = new vscode.EventEmitter<undefined | null | void>();
    readonly onChangeActiveDevices: vscode.Event<undefined | null | void> =
        this.changeEmitter.event;

    setActiveDevice(devices?: ErDeviceModel) {
        this.activeDevice = devices;
        this.changeEmitter.fire();
    }

    hasActiveDevice(): boolean {
        return this.activeDevice !== undefined;
    }

    getActiveDevice(): ErDeviceModel | undefined {
        return this.activeDevice;
    }
    getActiveDeviceName(): string | undefined {
        return this.activeDevice?.host;
    }
    dispose() {
        this.changeEmitter.dispose();
    }
}
