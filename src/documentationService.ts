import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LegacyDocApiClient } from './apiClient';
import { GenerationDepth, JobResponse, ProjectResponse } from './types/api';

const IGNORED_DIRS = new Set([
    '.git', 'node_modules', 'dist', 'build', 'out',
    '.venv', 'venv', '__pycache__', '.idea', '.vscode', 'docs_legacydoc'
]);

// Extensões padrão de código-fonte (usadas como fallback caso /v1/meta/languages falhe)
const DEFAULT_EXTENSIONS = new Set([
    '.c', '.cpp', '.cc', '.h', '.hpp',
    '.py', '.ts', '.tsx', '.js', '.jsx',
    '.java', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt'
]);

export class DocumentationService {
    constructor(private api: LegacyDocApiClient) {}

    /**
     * Lê a branch atual e a URL remota diretamente da pasta .git local
     */
    private getGitMetadata(rootPath: string): { repoUrl: string | null; defaultBranch: string | null } {
        let repoUrl: string | null = null;
        let defaultBranch: string | null = null;

        try {
            const headPath = path.join(rootPath, '.git', 'HEAD');
            if (fs.existsSync(headPath)) {
                const headContent = fs.readFileSync(headPath, 'utf-8').trim();
                if (headContent.startsWith('ref: refs/heads/')) {
                    defaultBranch = headContent.replace('ref: refs/heads/', '').trim();
                }
            }

            const configPath = path.join(rootPath, '.git', 'config');
            if (fs.existsSync(configPath)) {
                const configContent = fs.readFileSync(configPath, 'utf-8');
                const urlMatch = configContent.match(/^\s*url\s*=\s*(.+)$/m);
                if (urlMatch && urlMatch[1]) {
                    repoUrl = urlMatch[1].trim();
                }
            }
        } catch {
            // Ignora falhas de leitura do .git
        }

        return { repoUrl, defaultBranch };
    }

    /**
     * Verifica direto na API se o projeto já existe (pela URL do Git ou nome da pasta).
     * Se existir, atualiza via PATCH /v1/projects/{id}; senão, cria via POST /v1/projects.
     * Não gera nenhum arquivo extra no disco.
     */
    private async resolveAndSyncProject(
        rootPath: string
    ): Promise<{ project: ProjectResponse; isExistingProject: boolean }> {
        const projectName = path.basename(rootPath);
        const { repoUrl, defaultBranch } = this.getGitMetadata(rootPath);

        const existingProjects = await this.api.listProjects();

        // Procura projeto existente pela URL do repositório ou pelo nome da pasta
        const matchedProject = existingProjects.find(p =>
            (repoUrl && p.repo_url === repoUrl) ||
            p.name.toLowerCase() === projectName.toLowerCase()
        );

        if (matchedProject) {
            const project = await this.api.updateProject(matchedProject.id, {
                name: projectName,
                repo_url: repoUrl ?? matchedProject.repo_url,
                default_branch: defaultBranch ?? matchedProject.default_branch,
                description: `Atualizado via VS Code Extension em ${new Date().toLocaleString('pt-BR')}`
            });
            return { project, isExistingProject: true };
        }

        const project = await this.api.createProject({
            name: projectName,
            repo_url: repoUrl,
            default_branch: defaultBranch,
            description: 'Gerado via VS Code Extension'
        });

        return { project, isExistingProject: false };
    }

    /**
     * Coleta todos os arquivos de código válidos dentro do repositório local
     */
    private async collectSourceFiles(rootPath: string): Promise<Array<{ relativePath: string; content: string }>> {
        let allowedExtensions = DEFAULT_EXTENSIONS;

        try {
            const langs = await this.api.getSupportedLanguages();
            const apiExts = langs.flatMap(l =>
                l.extensions.map(ext => (ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`))
            );
            if (apiExts.length > 0) {
                allowedExtensions = new Set(apiExts);
            }
        } catch {
            // Usa lista padrão caso falhe
        }

        const files: Array<{ relativePath: string; content: string }> = [];

        const scanDir = (currentPath: string) => {
            const entries = fs.readdirSync(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                if (IGNORED_DIRS.has(entry.name)) {
                    continue;
                }

                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    scanDir(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (!allowedExtensions.has(ext)) {
                        continue;
                    }

                    const content = fs.readFileSync(fullPath, 'utf-8').trim();
                    if (content.length > 0 && content.length <= 1000000) {
                        const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
                        files.push({ relativePath, content });
                    }
                }
            }
        };

        scanDir(rootPath);
        return files;
    }

    /**
     * Aguarda a conclusão do Job consultando GET /v1/jobs/{id}
     */
    private async pollJobUntilFinished(
        jobId: string,
        fileLabel: string,
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken
    ): Promise<JobResponse> {
        while (true) {
            if (token.isCancellationRequested) {
                await this.api.cancelJob(jobId);
                throw new Error('Operação cancelada pelo usuário.');
            }

            const job = await this.api.getJob(jobId);

            progress.report({
                message: `[${fileLabel}] ${job.progress_message || job.status} (${job.progress_percent}%)`
            });

            if (job.status === 'completed' || job.status === 'succeeded' || job.status === 'done') {
                return job;
            }

            if (job.status === 'failed' || job.status === 'error' || job.status === 'cancelled') {
                throw new Error(job.error_message || `O Job falhou com status: ${job.status}`);
            }

            await new Promise(resolve => setTimeout(resolve, 2500));
        }
    }

    /**
     * Sincroniza o projeto na API e gera/atualiza apenas os arquivos .md ou .pdf
     */
    async generateWorkspaceDocumentation(
        rootPath: string,
        exportFormat: 'markdown' | 'pdf',
        depth: GenerationDepth = 'standard'
    ): Promise<void> {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Legacy Doc',
                cancellable: true
            },
            async (progress, cancellationToken) => {
                const outputDir = path.join(rootPath, 'docs_legacydoc');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                // Se existir um .legacydoc.json antigo de testes anteriores, remove automaticamente
                const oldConfigFile = path.join(outputDir, '.legacydoc.json');
                if (fs.existsSync(oldConfigFile)) {
                    fs.unlinkSync(oldConfigFile);
                }

                progress.report({ message: 'Verificando registro do projeto na API...' });
                const { project, isExistingProject } = await this.resolveAndSyncProject(rootPath);

                progress.report({
                    message: isExistingProject
                        ? `Projeto "${project.name}" detectado! Lendo arquivos para atualizar...`
                        : `Novo projeto "${project.name}" criado! Lendo arquivos...`
                });

                const sourceFiles = await this.collectSourceFiles(rootPath);
                if (sourceFiles.length === 0) {
                    vscode.window.showWarningMessage('Nenhum arquivo de código-fonte suportado foi encontrado na pasta.');
                    return;
                }

                const ext = exportFormat === 'pdf' ? 'pdf' : 'md';
                let updatedCount = 0;
                let createdCount = 0;

                for (let i = 0; i < sourceFiles.length; i++) {
                    const file = sourceFiles[i];
                    const stepLabel = `${i + 1}/${sourceFiles.length}: ${file.relativePath}`;

                    progress.report({
                        message: `${isExistingProject ? 'Atualizando' : 'Gerando'} ${stepLabel}...`
                    });

                    const job = await this.api.createJob({
                        job_type: 'document_snippet',
                        path: file.relativePath,
                        content: file.content,
                        project_id: project.id,
                        output_language: 'pt-BR',
                        depth
                    });

                    const finishedJob = await this.pollJobUntilFinished(
                        job.id,
                        stepLabel,
                        progress,
                        cancellationToken
                    );

                    const docs = await this.api.listDocuments({
                        job_id: finishedJob.id,
                        project_id: project.id,
                        limit: 50
                    });

                    for (const docSummary of docs) {
                        const exportedBuffer = await this.api.exportDocument(docSummary.id, exportFormat);
                        const safeName = docSummary.path.replace(/[\\/]/g, '_');
                        const targetFile = path.join(outputDir, `${safeName}.${ext}`);

                        const fileAlreadyExisted = fs.existsSync(targetFile);

                        // Sobrescreve diretamente o arquivo .md ou .pdf
                        fs.writeFileSync(targetFile, exportedBuffer);

                        if (fileAlreadyExisted) {
                            updatedCount++;
                        } else {
                            createdCount++;
                        }
                    }
                }

                if (updatedCount > 0 && createdCount === 0) {
                    vscode.window.showInformationMessage(
                        `Projeto "${project.name}" atualizado! ${updatedCount} documentação(ões) atualizada(s) em "docs_legacydoc".`
                    );
                } else if (updatedCount > 0 && createdCount > 0) {
                    vscode.window.showInformationMessage(
                        `Projeto "${project.name}" sincronizado! ${updatedCount} atualizada(s) e ${createdCount} nova(s) em "docs_legacydoc".`
                    );
                } else {
                    vscode.window.showInformationMessage(
                        `Documentação gerada para "${project.name}"! ${createdCount} arquivo(s) salvo(s) em "docs_legacydoc".`
                    );
                }
            }
        );
    }
}