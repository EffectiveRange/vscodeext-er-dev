// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import { ErDeviceModel } from './api';
import { ERExtension } from './erextension';

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
    private extension_: ERExtension;
    constructor(extension: ERExtension) {
        this.extension_ = extension;
    }

    get extension(): ERExtension {
        return this.extension_;
    }

    private changeEmitter = new vscode.EventEmitter<undefined | null | void>();
    readonly onChangeActiveDevices: vscode.Event<undefined | null | void> =
        this.changeEmitter.event;

    setActiveDevice(devices?: ErDeviceModel) {
        this.extension.logChannel.debug(`Setting active device with name ${devices?.host}`);
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
