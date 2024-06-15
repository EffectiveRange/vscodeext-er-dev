import * as vscode from 'vscode';

export class ERExtension {
    private logChannel_: vscode.LogOutputChannel;
    get logChannel(): vscode.LogOutputChannel {
        return this.logChannel_;
    }
    set logChannel(value: vscode.LogOutputChannel) {
        this.logChannel_ = value;
    }
    constructor() {
        this.logChannel_ = vscode.window.createOutputChannel('ER Extension', { log: true });
    }
}
