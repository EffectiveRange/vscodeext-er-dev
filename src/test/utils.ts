import path from 'path';
import * as vscode from 'vscode';

export async function getExtensionHandle(): Promise<vscode.Extension<any>> {
    const ext = findExt();
    let subsExt: () => Promise<vscode.Extension<any>> = async () => {
        if (ext === undefined) {
            return new Promise((resolve, reject) => {
                let disposable = vscode.extensions.onDidChange(() => {
                    const newExt = findExt();
                    if (newExt !== undefined) {
                        resolve(newExt);
                        disposable.dispose();
                    }
                });
            });
        } else {
            return Promise.resolve(ext);
        }
    };
    let extHandle = await subsExt();
    if (!extHandle.isActive) {
        console.warn('activating extension');
        await extHandle.activate();
    } else {
        console.warn('extension already active');
    }

    function findExt() {
        return vscode.extensions.all.find((ext, index, exts) => {
            return ext.id === 'EffectiveRangeLLC.erdev';
        });
    }

    return extHandle;
}

export async function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export function getWorkspace(name: string): vscode.WorkspaceFolder {
    const wsp = vscode.workspace.workspaceFolders?.find((val, idx, obj) => {
        return val.name === name;
    });
    return wsp as vscode.WorkspaceFolder;
}

export function projectFilePath(wsp: vscode.WorkspaceFolder, ...relPath: string[]) {
    return vscode.Uri.file(path.join(wsp.uri.fsPath, ...relPath));
}

export async function openWorkspaceFile(wsp: vscode.WorkspaceFolder, ...relPath: string[]) {
    return vscode.window.showTextDocument(projectFilePath(wsp, ...relPath));
}
