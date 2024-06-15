// SPDX-FileCopyrightText: 2024 Ferenc Nandor Janky <ferenj@effective-range.com>
// SPDX-FileCopyrightText: 2024 Attila Gombos <attila.gombos@effective-range.com>
// SPDX-License-Identifier: MIT

import { Directive, LineType, parse, Section } from 'ssh-config';
import * as fs from 'fs';
import * as os from 'os';

interface SSHConfigurationEntry {
    host: string;
    hostname: string;
    identity?: string;
    user?: string;
}

interface SSHConfiguration {
    exists: boolean;
    hosts: SSHConfigurationEntry[];
}

export class SSHParser {
    private config: SSHConfiguration;

    private toEntry(cfg: Section): SSHConfigurationEntry {
        const directives = cfg.config
            .filter((r) => r.type === LineType.DIRECTIVE)
            .map((r) => r as Directive);
        const host = cfg.value.toString();
        const hostname = getCfgDirective(directives, 'HostName', host);
        const identity = getCfgDirective(directives, 'IdentityFile');
        const user = getCfgDirective(directives, 'User');
        return { host, hostname: hostname ?? host, identity, user };
    }

    constructor(configPath: string) {
        if (configPath.startsWith('~')) {
            configPath = configPath.replace('~', os.homedir());
        }
        if (!fs.existsSync(configPath)) {
            this.config = { exists: false, hosts: [] };
            return;
        }
        let buffer = fs.readFileSync(configPath);
        let cfg = parse(buffer.toString());
        this.config = {
            exists: true,
            hosts: cfg
                .filter((r) => r.type === LineType.DIRECTIVE)
                .map((r) => r as Section)
                .filter((r) => r !== undefined)
                .filter((r) => r.param === 'Host')
                .map((r) => this.toEntry(r)),
        };
    }

    public hasConfig(): boolean {
        return this.config.exists;
    }

    public hosts() {
        return this.config.hosts;
    }
}

export class CPackExecutor {
    public pasrseCPackOutput(output: string): string[] {
        let lines = output.split('\n');
        let re = /^\s*CPack:\s*-\s*package:\s*((?:\/[^/ ]*)+)\/?.*/;
        return lines
            .filter((r) => r.startsWith('CPack: - package: '))
            .map((r) => r.match(re))
            .filter((r) => !!r)
            .map((r) => r![1]);
    }
}
function getCfgDirective(directives: Directive[], key: string, defValue?: string) {
    const hostnameIdx = directives.findIndex((d, i) => d.param === key);
    const hostname = hostnameIdx >= 0 ? (directives[hostnameIdx].value as string) : defValue;
    return hostname;
}

export function randomUniformInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export function getRandomPort(): number {
    const minPort = 1024;
    const maxPort = 65535;
    return randomUniformInt(minPort, maxPort);
}
