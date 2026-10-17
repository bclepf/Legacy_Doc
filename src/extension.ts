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

    // 1.5 Comando de Cadastro (Criar Nova Conta via /v1/auth/register)
    const registerCmd = vscode.commands.registerCommand('legacydoc.register', async () => {
        const displayName = await vscode.window.showInputBox({
            title: 'Criar Conta no Legacy Doc (1/4)',
            prompt: 'Digite seu nome de exibição (opcional — pressione Enter para pular)',
            placeHolder: 'Ex: João Silva',
            validateInput: (val) => val.length > 120 ? 'O nome deve ter no máximo 120 caracteres.' : null
        });
        if (displayName === undefined) return; // Cancelado com Esc

        const email = await vscode.window.showInputBox({
            title: 'Criar Conta no Legacy Doc (2/4)',
            prompt: 'Digite seu e-mail',
            placeHolder: 'seu@email.com',
            validateInput: (val) => {
                if (!val || !val.includes('@')) {
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
// 1.6 Comando de Recuperação de Senha (Fluxo contínuo e direto)
    const resetPasswordCmd = vscode.commands.registerCommand('legacydoc.resetPassword', async () => {
        // Etapa 1: Solicita apenas o e-mail imediatamente ao clicar no botão
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

        // Dispara o envio do e-mail na API
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

        // Etapa 2: Abre imediatamente o campo aguardando o código (mantém aberto ao trocar de janela)
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

        // Caso o usuário cole um link completo do e-mail (ex: ?token=xyz), extrai apenas o código automaticamente
        let cleanToken = tokenInput.trim();
        if (cleanToken.includes('token=')) {
            try {
                const urlParams = new URLSearchParams(cleanToken.split('?')[1]);
                cleanToken = urlParams.get('token') || cleanToken;
            } catch {
                // Mantém o valor original se não for uma URL padrão
            }
        }

        // Etapa 3: Nova Senha
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

        // Etapa 4: Confirmação da Nova Senha
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

        // Confirma na API e já inicia a sessão automaticamente
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

    // 5. Comando para Listar, Visualizar, Baixar e Deletar Documentações (/v1/documents)
    const DELETED_DOCS_KEY = 'legacydoc.deletedDocumentIds';

    const removerDocumentacao = async (docId: string, docPath: string) => {
        try {
            // Tenta deletar diretamente na API
            await apiClient.deleteDocument(docId);
        } catch (err: any) {
            // Se a rota DELETE /v1/documents/{id} ainda não existir no backend (404/405),
            // registra o ID localmente para removê-lo da listagem da extensão
            const msg = String(err.message || '');
            if (msg.includes('405') || msg.includes('404')) {
                const ocultos = context.globalState.get<string[]>(DELETED_DOCS_KEY, []);
                if (!ocultos.includes(docId)) {
                    await context.globalState.update(DELETED_DOCS_KEY, [...ocultos, docId]);
                }
            } else {
                throw err;
            }
        }

        // Se existir arquivo local gerado em docs_legacydoc/, remove do disco também
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
            const allDocs = await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Legacy Doc: Buscando histórico de documentações...'
                },
                async () => {
                    return await apiClient.listDocuments({ limit: 200 });
                }
            );

            // Filtra documentações que já foram excluídas
            const deletedIds = new Set(context.globalState.get<string[]>(DELETED_DOCS_KEY, []));
            const docs = (allDocs || []).filter(d => !deletedIds.has(d.id));

            if (docs.length === 0) {
                vscode.window.showInformationMessage('Nenhuma documentação disponível nesta conta.');
                return;
            }

            // Item especial no topo para exclusão em lote + lista de documentos
            const batchDeleteOption = {
                label: '$(trash) Excluir Várias Documentações Antigas...',
                description: 'Selecionar múltiplos registros para apagar de uma vez',
                detail: 'Limpe documentações antigas do seu histórico',
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

            // Fluxo 1: Exclusão em Lote (Múltipla escolha com checkboxes)
            if (selecionado.isBatchDelete) {
                const paraExcluir = await vscode.window.showQuickPick(docItems, {
                    title: 'Selecione as documentações antigas que deseja excluir',
                    placeHolder: 'Marque os itens desejados e pressione Enter para confirmar',
                    canPickMany: true,
                    matchOnDescription: true
                });

                if (!paraExcluir || paraExcluir.length === 0) return;

                const confirmacao = await vscode.window.showWarningMessage(
                    `Tem certeza que deseja excluir ${paraExcluir.length} documentação(ões)?`,
                    { modal: true },
                    'Sim, Excluir'
                );

                if (confirmacao !== 'Sim, Excluir') return;

                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: 'Legacy Doc: Excluindo documentações selecionadas...'
                    },
                    async () => {
                        for (const item of paraExcluir) {
                            await removerDocumentacao(item.doc.id, item.doc.path);
                        }
                    }
                );

                vscode.window.showInformationMessage(`${paraExcluir.length} documentação(ões) excluída(s) com sucesso.`);
                return;
            }

            // Fluxo 2: Ações para uma única documentação selecionada
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
                        description: 'Remove esta documentação do histórico e da pasta local',
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
                    `Deseja realmente excluir a documentação de "${selecionado.doc.path}" (${dataDoc})?`,
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
                        await removerDocumentacao(selecionado.doc.id, selecionado.doc.path);
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
        listDocsCmd,
        logoutCmd,
        generateMdCmd,
        generatePdfCmd
    );
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