// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

export interface ErDeviceModel {
    id: string;
    host: string;
    hostname: string;
    identity?: string;
    user?: string;
}

export interface ErDevApi {
    setActiveDevice: (model: ErDeviceModel) => void;
    enableArgsPick: (enable: boolean) => void;
}
