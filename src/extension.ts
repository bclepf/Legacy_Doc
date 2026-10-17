import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LegacyDocApiClient } from './apiClient';
import { DocumentationService } from './documentationService';

export async function activate(context: vscode.ExtensionContext) {
    const apiClient = new LegacyDocApiClient(context.secrets);
    const docService = new DocumentationService(apiClient);

    // Registra a view vazia para renderizar os botões do viewsWelcome
    vscode.window.registerTreeDataProvider('legacydoc.welcomeView', {
        getTreeItem: (element: vscode.TreeItem) => element,
        getChildren: () => []
    });

    // Função auxiliar para atualizar o estado de login na interface do VS Code
    const definirEstadoLogin = async (autenticado: boolean) => {
        await vscode.commands.executeCommand('setContext', 'legacydoc.isAuthenticated', autenticado);
    };

    // Verifica na inicialização se já existe um token/API Key válido salvo
    await validarSessaoInicial(apiClient, definirEstadoLogin);

    // 1. Comando de Login
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
                if (!apiKey) return;

                await apiClient.setToken(apiKey.trim());
                const user = await apiClient.getMe();
                await definirEstadoLogin(true);
                vscode.window.showInformationMessage(`Autenticado como ${user.email} (Plano: ${user.plan.display_name})`);
            } else {
                const email = await vscode.window.showInputBox({ prompt: 'Digite seu e-mail' });
                if (!email) return;
                const password = await vscode.window.showInputBox({ prompt: 'Digite sua senha', password: true });
                if (!password) return;

                await apiClient.login({ email, password });
                const user = await apiClient.getMe();
                await definirEstadoLogin(true);
                vscode.window.showInformationMessage(`Bem-vindo, ${user.display_name || user.email}!`);
            }
        } catch (err: any) {
            // Se a credencial inserida for inválida, limpa o token e mantém deslogado
            await apiClient.clearToken();
            await definirEstadoLogin(false);
            vscode.window.showErrorMessage(`Falha na autenticação: ${err.message}`);
        }
    });

    // 2. Comando de Logout
    const logoutCmd = vscode.commands.registerCommand('legacydoc.logout', async () => {
        await apiClient.clearToken();
        await definirEstadoLogin(false);
        vscode.window.showInformationMessage('Sessão encerrada no Legacy Doc.');
    });

    // 3. Comando para Gerar Markdown
    const generateMdCmd = vscode.commands.registerCommand('legacydoc.generateMarkdown', async () => {
        const rootPath = validarRepositorioGit();
        if (!rootPath) return;

        try {
            await docService.generateWorkspaceDocumentation(rootPath, 'markdown', 'standard');
        } catch (err: any) {
            vscode.window.showErrorMessage(`Erro: ${err.message}`);
        }
    });

    // 4. Comando para Gerar PDF
    const generatePdfCmd = vscode.commands.registerCommand('legacydoc.generatePdf', async () => {
        const rootPath = validarRepositorioGit();
        if (!rootPath) return;

        try {
            await docService.generateWorkspaceDocumentation(rootPath, 'pdf', 'standard');
        } catch (err: any) {
            vscode.window.showErrorMessage(`Erro: ${err.message}`);
        }
    });

    context.subscriptions.push(loginCmd, logoutCmd, generateMdCmd, generatePdfCmd);
}

/**
 * Testa o token salvo ao abrir o VS Code; se expirado ou inexistente, bloqueia a UI
 */
async function validarSessaoInicial(
    apiClient: LegacyDocApiClient,
    definirEstadoLogin: (autenticado: boolean) => Promise<void>
) {
    const token = await apiClient.getToken();
    if (!token) {
        await definirEstadoLogin(false);
        return;
    }

    try {
        await apiClient.getMe();
        await definirEstadoLogin(true);
    } catch {
        // Token expirado ou revogado na API
        await apiClient.clearToken();
        await definirEstadoLogin(false);
    }
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