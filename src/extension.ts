import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LegacyDocApiClient } from './apiClient';
import { DocumentationService } from './documentationService';

export function activate(context: vscode.ExtensionContext) {
    const apiClient = new LegacyDocApiClient(context.secrets);
    const docService = new DocumentationService(apiClient);

	// Registra uma árvore vazia para habilitar a tela de boas-vindas com os botões
	vscode.window.registerTreeDataProvider('legacydoc.welcomeView', {
    getTreeItem: (element: vscode.TreeItem) => element,
    getChildren: () => []
	});

    // 1. Comando de Login (Email/Senha ou API Key)
    const loginCmd = vscode.commands.registerCommand('legacydoc.login', async () => {
        const metodo = await vscode.window.showQuickPick(
            ['Entrar com E-mail e Senha', 'Inserir API Key (Longa Duração)'],
            { placeHolder: 'Escolha como deseja autenticar no Legacy Doc' }
        );

        if (!metodo) return;

        try {
            if (metodo.startsWith('Inserir API Key')) {
                const apiKey = await vscode.window.showInputBox({
                    prompt: 'Cole sua API Key do Legacy Doc',
                    password: true
                });
                if (apiKey) {
                    await apiClient.setToken(apiKey.trim());
                    const user = await apiClient.getMe();
                    vscode.window.showInformationMessage(`Autenticado como ${user.email} (Plano: ${user.plan.display_name})`);
                }
            } else {
                const email = await vscode.window.showInputBox({ prompt: 'Digite seu e-mail' });
                if (!email) return;
                const password = await vscode.window.showInputBox({ prompt: 'Digite sua senha', password: true });
                if (!password) return;

                await apiClient.login({ email, password });
                const user = await apiClient.getMe();
                vscode.window.showInformationMessage(`Bem-vindo, ${user.display_name || user.email}!`);
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Falha na autenticação: ${err.message}`);
        }
    });

    // 2. Comando para Gerar Markdown (Verifica se há pasta .git aberta)
    const generateMdCmd = vscode.commands.registerCommand('legacydoc.generateMarkdown', async () => {
        const rootPath = validarRepositorioGit();
        if (!rootPath) return;

        try {
            await docService.generateWorkspaceDocumentation(rootPath, 'markdown', 'standard');
        } catch (err: any) {
            vscode.window.showErrorMessage(`Erro: ${err.message}`);
        }
    });

    // 3. Comando para Gerar PDF
    const generatePdfCmd = vscode.commands.registerCommand('legacydoc.generatePdf', async () => {
        const rootPath = validarRepositorioGit();
        if (!rootPath) return;

        try {
            await docService.generateWorkspaceDocumentation(rootPath, 'pdf', 'standard');
        } catch (err: any) {
            vscode.window.showErrorMessage(`Erro: ${err.message}`);
        }
    });

    context.subscriptions.push(loginCmd, generateMdCmd, generatePdfCmd);
}

function validarRepositorioGit(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('Abra uma pasta no VS Code antes de gerar a documentação.');
        return undefined;
    }
    const rootPath = folders[0].uri.fsPath;
    if (!fs.existsSync(path.join(rootPath, '.git'))) {
        vscode.window.showWarningMessage('A pasta aberta não contém um repositório Git (.git não encontrado).');
        return undefined;
    }
    return rootPath;
}