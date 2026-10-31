import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LegacyDocApiClient } from './apiClient';
import { DocumentationService } from './documentationService';
import { UsageViewProvider } from './usageViewProvider';

export function activate(context: vscode.ExtensionContext) {
    const apiClient = new LegacyDocApiClient(context.secrets);
    const usageProvider = new UsageViewProvider(apiClient);

    // Passa o callback para atualizar a barra de créditos sempre que uma documentação for gerada
    const docService = new DocumentationService(
        apiClient,
        context.workspaceState,
        async () => {
            await usageProvider.refresh();
        }
    );

    // Registra o Webview da barra de consumo de créditos
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(UsageViewProvider.viewType, usageProvider),
        usageProvider
    );

    // Registra a árvore vazia para os botões do viewsWelcome
    vscode.window.registerTreeDataProvider('legacydoc.welcomeView', {
        getTreeItem: (element: vscode.TreeItem) => element,
        getChildren: () => []
    });

    // Atualiza o estado de login e sincroniza automaticamente a barra de créditos com a API
    const definirEstadoLogin = async (autenticado: boolean) => {
        await vscode.commands.executeCommand('setContext', 'legacydoc.isAuthenticated', autenticado);
        if (autenticado) {
            await usageProvider.refresh();
        } else {
            usageProvider.clear();
        }
    };

    // Comando para atualizar manualmente o saldo caso o usuário faça uma recarga no painel web
    const refreshUsageCmd = vscode.commands.registerCommand('legacydoc.refreshUsage', async () => {
        await usageProvider.refresh();
    });

    // =========================================================================
    // 1. COMANDO DE LOGIN (E-mail/Senha ou API Key)
    // =========================================================================
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
                    password: true,
                    ignoreFocusOut: true
                });
                if (!apiKey) return;

                await apiClient.setToken(apiKey.trim());
                const user = await apiClient.getMe();
                await definirEstadoLogin(true);
                vscode.window.showInformationMessage(
                    `Autenticado como ${user.email} (Plano: ${user.plan.display_name})`
                );
            } else {
                const email = await vscode.window.showInputBox({
                    prompt: 'Digite seu e-mail',
                    placeHolder: 'seu@email.com',
                    ignoreFocusOut: true
                });
                if (!email) return;

                const password = await vscode.window.showInputBox({
                    prompt: 'Digite sua senha',
                    password: true,
                    ignoreFocusOut: true
                });
                if (!password) return;

                await apiClient.login({ email: email.trim(), password });
                const user = await apiClient.getMe();
                await definirEstadoLogin(true);
                vscode.window.showInformationMessage(`Bem-vindo, ${user.display_name || user.email}!`);
            }
        } catch (err: any) {
            await apiClient.clearToken();
            await definirEstadoLogin(false);
            vscode.window.showErrorMessage(`Falha na autenticação: ${err.message}`);
        }
    });

    // =========================================================================
    // 2. COMANDO DE CADASTRO (Criar Nova Conta)
    // =========================================================================
    const registerCmd = vscode.commands.registerCommand('legacydoc.register', async () => {
        const displayName = await vscode.window.showInputBox({
            title: 'Criar Conta no Legacy Doc (1/4)',
            prompt: 'Digite seu nome de exibição (opcional — pressione Enter para pular)',
            placeHolder: 'Ex: João Silva',
            ignoreFocusOut: true,
            validateInput: (val) => (val.length > 120 ? 'O nome deve ter no máximo 120 caracteres.' : null)
        });
        if (displayName === undefined) return;

        const email = await vscode.window.showInputBox({
            title: 'Criar Conta no Legacy Doc (2/4)',
            prompt: 'Digite seu e-mail',
            placeHolder: 'seu@email.com',
            ignoreFocusOut: true,
            validateInput: (val) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!val || !emailRegex.test(val.trim())) {
                    return 'Informe um endereço de e-mail válido.';
                }
                return null;
            }
        });
        if (!email) return;

        const password = await vscode.window.showInputBox({
            title: 'Criar Conta no Legacy Doc (3/4)',
            prompt: 'Crie uma senha',
            password: true,
            ignoreFocusOut: true,
            validateInput: (val) => {
                if (!val || val.length < 6) {
                    return 'A senha deve ter pelo menos 6 caracteres.';
                }
                return null;
            }
        });
        if (!password) return;

        const confirmPassword = await vscode.window.showInputBox({
            title: 'Criar Conta no Legacy Doc (4/4)',
            prompt: 'Confirme sua senha',
            password: true,
            ignoreFocusOut: true,
            validateInput: (val) => {
                if (val !== password) {
                    return 'As senhas não coincidem.';
                }
                return null;
            }
        });
        if (!confirmPassword) return;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Legacy Doc: Criando sua conta...'
                },
                async () => {
                    await apiClient.register({
                        email: email.trim(),
                        password,
                        display_name: displayName.trim() ? displayName.trim() : null
                    });

                    const user = await apiClient.getMe();
                    await definirEstadoLogin(true);
                    vscode.window.showInformationMessage(
                        `Conta criada com sucesso! Bem-vindo(a), ${user.display_name || user.email} (Plano: ${user.plan.display_name}).`
                    );
                }
            );
        } catch (err: any) {
            await apiClient.clearToken();
            await definirEstadoLogin(false);
            vscode.window.showErrorMessage(`Não foi possível criar a conta: ${err.message}`);
        }
    });

    // =========================================================================
    // 3. COMANDO DE RECUPERAÇÃO DE SENHA (Fluxo Contínuo)
    // =========================================================================
    const resetPasswordCmd = vscode.commands.registerCommand('legacydoc.resetPassword', async () => {
        const email = await vscode.window.showInputBox({
            title: 'Recuperar Senha (1/4) — Informe seu E-mail',
            prompt: 'Digite o e-mail cadastrado para receber o código de validação',
            placeHolder: 'seu@email.com',
            ignoreFocusOut: true,
            validateInput: (val) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!val || !emailRegex.test(val.trim())) {
                    return 'Informe um endereço de e-mail válido.';
                }
                return null;
            }
        });
        if (!email) return;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Legacy Doc: Enviando código de recuperação para o seu e-mail...'
                },
                async () => {
                    await apiClient.requestPasswordReset({ email: email.trim() });
                }
            );
        } catch (err: any) {
            vscode.window.showErrorMessage(`Erro ao solicitar recuperação: ${err.message}`);
            return;
        }

        const tokenInput = await vscode.window.showInputBox({
            title: 'Recuperar Senha (2/4) — Código de Validação',
            prompt: `Código enviado para ${email.trim()}. Verifique seu e-mail e cole o código abaixo:`,
            placeHolder: 'Cole aqui o código recebido por e-mail',
            ignoreFocusOut: true,
            validateInput: (val) => {
                if (!val || val.trim().length < 16) {
                    return 'O código de validação deve ter pelo menos 16 caracteres.';
                }
                return null;
            }
        });
        if (!tokenInput) return;

        // Extrai apenas o token caso o usuário tenha colado uma URL inteira
        let cleanToken = tokenInput.trim();
        if (cleanToken.includes('token=')) {
            try {
                const urlParams = new URLSearchParams(cleanToken.split('?')[1]);
                cleanToken = urlParams.get('token') || cleanToken;
            } catch {
                // Mantém o texto original se não for uma query string padrão
            }
        }

        const newPassword = await vscode.window.showInputBox({
            title: 'Recuperar Senha (3/4) — Nova Senha',
            prompt: 'Digite sua nova senha',
            password: true,
            ignoreFocusOut: true,
            validateInput: (val) => {
                if (!val || val.length < 6) {
                    return 'A nova senha deve ter pelo menos 6 caracteres.';
                }
                return null;
            }
        });
        if (!newPassword) return;

        const confirmNewPassword = await vscode.window.showInputBox({
            title: 'Recuperar Senha (4/4) — Confirmar Nova Senha',
            prompt: 'Digite novamente sua nova senha',
            password: true,
            ignoreFocusOut: true,
            validateInput: (val) => {
                if (val !== newPassword) {
                    return 'As senhas não coincidem.';
                }
                return null;
            }
        });
        if (!confirmNewPassword) return;

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Legacy Doc: Validando código e atualizando senha...'
                },
                async () => {
                    await apiClient.confirmPasswordReset({
                        token: cleanToken,
                        new_password: newPassword
                    });

                    const user = await apiClient.getMe();
                    await definirEstadoLogin(true);
                    vscode.window.showInformationMessage(
                        `Senha redefinida com sucesso! Conectado como ${user.display_name || user.email}.`
                    );
                }
            );
        } catch (err: any) {
            await apiClient.clearToken();
            await definirEstadoLogin(false);
            vscode.window.showErrorMessage(`Código inválido ou expirado: ${err.message}`);
        }
    });

    // =========================================================================
    // 4. COMANDO DE LOGOUT
    // =========================================================================
    const logoutCmd = vscode.commands.registerCommand('legacydoc.logout', async () => {
        await apiClient.clearToken();
        await definirEstadoLogin(false);
        vscode.window.showInformationMessage('Sessão encerrada no Legacy Doc.');
    });

    // =========================================================================
    // 5. COMANDOS DE GERAÇÃO / ATUALIZAÇÃO DE DOCUMENTAÇÃO (.MD e .PDF)
    // =========================================================================
    const generateMdCmd = vscode.commands.registerCommand('legacydoc.generateMarkdown', async () => {
        const rootPath = validarRepositorioGit();
        if (!rootPath) return;

        try {
            await docService.generateWorkspaceDocumentation(rootPath, 'markdown', 'standard');
        } catch (err: any) {
            vscode.window.showErrorMessage(`Erro: ${err.message}`);
        }
    });

    const generatePdfCmd = vscode.commands.registerCommand('legacydoc.generatePdf', async () => {
        const rootPath = validarRepositorioGit();
        if (!rootPath) return;

        try {
            await docService.generateWorkspaceDocumentation(rootPath, 'pdf', 'standard');
        } catch (err: any) {
            vscode.window.showErrorMessage(`Erro: ${err.message}`);
        }
    });

    // =========================================================================
    // 6. COMANDO DE HISTÓRICO (Listar, Visualizar, Baixar e Excluir)
    // =========================================================================
    const removerDocumentacao = async (jobId: string, docPath: string) => {
        // Deleta o registro no banco de dados via DELETE /v1/jobs/{job_id}/history
        await apiClient.deleteJobRecord(jobId);

        // Remove também o arquivo local em docs_legacydoc/ caso exista no workspace aberto
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceFolder) {
            const safeName = docPath.replace(/[\\/]/g, '_');
            const docsDir = path.join(workspaceFolder, 'docs_legacydoc');
            for (const ext of ['md', 'pdf']) {
                const localFile = path.join(docsDir, `${safeName}.${ext}`);
                if (fs.existsSync(localFile)) {
                    fs.unlinkSync(localFile);
                }
            }
        }
    };

    const listDocsCmd = vscode.commands.registerCommand('legacydoc.listDocuments', async () => {
        try {
            // Limpa eventual cache local de versões anteriores
            await context.globalState.update('legacydoc.deletedDocumentIds', undefined);

            const docs = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Legacy Doc: Buscando histórico de documentações...'
                },
                async () => {
                    return await apiClient.listDocuments({ limit: 200 });
                }
            );

            if (!docs || docs.length === 0) {
                vscode.window.showInformationMessage('Nenhuma documentação disponível nesta conta.');
                return;
            }

            const batchDeleteOption = {
                label: '$(trash) Excluir Várias Documentações Antigas...',
                description: 'Selecionar múltiplos registros para apagar do banco de dados',
                detail: 'Remove as documentações selecionadas da conta (Extensão e Painel Web)',
                isBatchDelete: true,
                doc: undefined as any
            };

            const docItems = docs.map((doc) => {
                const dataFormatada = new Date(doc.created_at).toLocaleString('pt-BR');
                return {
                    label: `$(file-code) ${doc.path}`,
                    description: `${doc.language.toUpperCase()} • ${doc.depth} • ${dataFormatada}`,
                    detail: `${doc.summary || 'Sem resumo disponível'} (${doc.symbol_count} símbolos | ${doc.finding_count} apontamentos)`,
                    isBatchDelete: false,
                    doc
                };
            });

            const selecionado = await vscode.window.showQuickPick(
                [batchDeleteOption, ...docItems],
                {
                    title: `Minhas Documentações Geradas (${docs.length})`,
                    placeHolder: 'Pesquise um arquivo ou escolha a opção de excluir várias...',
                    matchOnDescription: true,
                    matchOnDetail: true
                }
            );

            if (!selecionado) return;

            // Fluxo A: Exclusão em Lote
            if (selecionado.isBatchDelete) {
                const paraExcluir = await vscode.window.showQuickPick(docItems, {
                    title: 'Selecione as documentações que deseja excluir permanentemente',
                    placeHolder: 'Marque os itens desejados e pressione Enter para confirmar',
                    canPickMany: true,
                    matchOnDescription: true
                });

                if (!paraExcluir || paraExcluir.length === 0) return;

                const confirmacao = await vscode.window.showWarningMessage(
                    `Tem certeza que deseja excluir permanentemente ${paraExcluir.length} documentação(ões)?`,
                    { modal: true },
                    'Sim, Excluir'
                );

                if (confirmacao !== 'Sim, Excluir') return;

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Legacy Doc: Excluindo documentações no servidor...'
                    },
                    async () => {
                        const jobsProcessados = new Set<string>();

                        for (const item of paraExcluir) {
                            if (!jobsProcessados.has(item.doc.job_id)) {
                                await removerDocumentacao(item.doc.job_id, item.doc.path);
                                jobsProcessados.add(item.doc.job_id);
                            }
                        }
                    }
                );

                vscode.window.showInformationMessage(`${paraExcluir.length} documentação(ões) excluída(s) com sucesso.`);
                return;
            }

            // Fluxo B: Ações para um documento individual
            const acao = await vscode.window.showQuickPick(
                [
                    {
                        label: '$(eye) Visualizar no Editor (Markdown)',
                        description: 'Abre a documentação em uma nova aba do VS Code',
                        id: 'preview'
                    },
                    {
                        label: '$(markdown) Salvar como Markdown (.md)',
                        description: 'Baixa o arquivo .md para o computador',
                        id: 'md'
                    },
                    {
                        label: '$(file-pdf) Salvar como PDF (.pdf)',
                        description: 'Baixa o arquivo .pdf para o computador',
                        id: 'pdf'
                    },
                    {
                        label: '$(trash) Excluir Documentação',
                        description: 'Remove permanentemente da conta e da pasta local',
                        id: 'delete'
                    }
                ],
                {
                    title: `Ações para: ${selecionado.doc.path}`,
                    placeHolder: 'Escolha o que deseja fazer com esta documentação'
                }
            );

            if (!acao) return;

            if (acao.id === 'delete') {
                const dataDoc = new Date(selecionado.doc.created_at).toLocaleString('pt-BR');
                const confirmar = await vscode.window.showWarningMessage(
                    `Deseja realmente excluir permanentemente a documentação de "${selecionado.doc.path}" (${dataDoc})?`,
                    { modal: true },
                    'Sim, Excluir'
                );

                if (confirmar !== 'Sim, Excluir') return;

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `Legacy Doc: Excluindo ${selecionado.doc.path}...`
                    },
                    async () => {
                        await removerDocumentacao(selecionado.doc.job_id, selecionado.doc.path);
                    }
                );

                vscode.window.showInformationMessage(`Documentação de "${selecionado.doc.path}" excluída com sucesso!`);
            } else if (acao.id === 'preview') {
                const buffer = await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `Legacy Doc: Carregando ${selecionado.doc.path}...`
                    },
                    async () => await apiClient.exportDocument(selecionado.doc.id, 'markdown')
                );

                const textDocument = await vscode.workspace.openTextDocument({
                    content: buffer.toString('utf-8'),
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(textDocument, { preview: false });
            } else {
                const formato = acao.id === 'pdf' ? 'pdf' : 'markdown';
                const ext = acao.id === 'pdf' ? 'pdf' : 'md';
                const safeName = `${selecionado.doc.path.replace(/[\\/]/g, '_')}.${ext}`;

                const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                const defaultUri = workspaceFolder
                    ? vscode.Uri.file(path.join(workspaceFolder, safeName))
                    : vscode.Uri.file(safeName);

                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri,
                    filters: acao.id === 'pdf'
                        ? { 'Documento PDF': ['pdf'] }
                        : { 'Markdown': ['md'] },
                    title: `Salvar Documentação (${safeName})`
                });

                if (!saveUri) return;

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `Legacy Doc: Exportando arquivo .${ext}...`
                    },
                    async () => {
                        const buffer = await apiClient.exportDocument(selecionado.doc.id, formato);
                        fs.writeFileSync(saveUri.fsPath, buffer);
                    }
                );

                vscode.window.showInformationMessage(`Arquivo salvo em: ${saveUri.fsPath}`);
            }
        } catch (err: any) {
            vscode.window.showErrorMessage(`Erro ao gerenciar documentações: ${err.message}`);
        }
    });

    context.subscriptions.push(
        loginCmd,
        registerCmd,
        resetPasswordCmd,
        logoutCmd,
        generateMdCmd,
        generatePdfCmd,
        listDocsCmd,
        refreshUsageCmd
    );
}

/**
 * Verifica se há um token salvo ao iniciar o VS Code e valida sua vigência na API
 */
async function validarSessaoInicial(
    apiClient: LegacyDocApiClient,
    definirEstadoLogin: (autenticado: boolean) => Promise<void>
): Promise<void> {
    const token = await apiClient.getToken();
    if (!token) {
        await definirEstadoLogin(false);
        return;
    }

    try {
        await apiClient.getMe();
        await definirEstadoLogin(true);
    } catch {
        await apiClient.clearToken();
        await definirEstadoLogin(false);
    }
}

/**
 * Garante que há uma pasta aberta no VS Code com um repositório Git inicializado (.git)
 */
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

export function deactivate() {}