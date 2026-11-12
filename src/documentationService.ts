import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LegacyDocApiClient } from './apiClient';
import { DocumentSummaryResponse, GenerationDepth, JobResponse, ProjectResponse } from './types/api';

const IGNORED_DIRS = new Set([
    '.git', 'node_modules', 'dist', 'build', 'out',
    '.venv', 'venv', '__pycache__', '.idea', '.vscode', 'docs_legacydoc'
]);

const DEFAULT_EXTENSIONS = new Set([
    '.c', '.cpp', '.cc', '.h', '.hpp',
    '.py', '.ts', '.tsx', '.js', '.jsx',
    '.java', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt'
]);

const WORKSPACE_PROJECT_ID_KEY = 'legacydoc.workspace.projectId';

export class DocumentationService {
    constructor(
        private api: LegacyDocApiClient,
        private workspaceState?: vscode.Memento,
        private onUsageUpdated?: () => Promise<void>
    ) {}

    /**
     * Normaliza strings de nomes/slugs para evitar duplicação por maiúsculas, acentos ou símbolos
     */
    private normalizeIdentifier(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Normaliza URLs do Git (HTTPS e SSH) para comparação consistente
     */
    private normalizeGitUrl(url: string | null | undefined): string | null {
        if (!url) {
            return null;
        }
        return url
            .trim()
            .toLowerCase()
            .replace(/^git@([^:]+):/, 'https://$1/')
            .replace(/\.git$/, '')
            .replace(/\/+$/, '');
    }

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
     * Busca o projeto correspondente ao repositório local na API sem criar um novo
     */
    public async findExistingProject(rootPath: string): Promise<ProjectResponse | undefined> {
        const projectName = path.basename(rootPath).trim();
        const normalizedTargetName = this.normalizeIdentifier(projectName);
        const { repoUrl } = this.getGitMetadata(rootPath);
        const normalizedTargetUrl = this.normalizeGitUrl(repoUrl);

        const existingProjects = await this.api.listProjects();
        const savedProjectId = this.workspaceState?.get<string>(WORKSPACE_PROJECT_ID_KEY);

        const matchingProjects = existingProjects.filter((p) => {
            if (savedProjectId && p.id === savedProjectId) {
                return true;
            }
            const pUrl = this.normalizeGitUrl(p.repo_url);
            if (normalizedTargetUrl && pUrl && pUrl === normalizedTargetUrl) {
                return true;
            }
            const pName = this.normalizeIdentifier(p.name);
            const pSlug = this.normalizeIdentifier(p.slug || '');
            return pName === normalizedTargetName || pSlug === normalizedTargetName;
        });

        if (matchingProjects.length === 0) {
            return undefined;
        }

        matchingProjects.sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        return matchingProjects[0];
    }

    /**
     * Localiza o projeto existente ou cria um novo (Mude de 'private' para 'public')
     */
    public async resolveAndSyncProject(
        rootPath: string
    ): Promise<{ project: ProjectResponse; isExistingProject: boolean }> {
        const projectName = path.basename(rootPath).trim();
        const normalizedTargetName = this.normalizeIdentifier(projectName);
        const { repoUrl, defaultBranch } = this.getGitMetadata(rootPath);
        const normalizedTargetUrl = this.normalizeGitUrl(repoUrl);

        const existingProjects = await this.api.listProjects();
        const savedProjectId = this.workspaceState?.get<string>(WORKSPACE_PROJECT_ID_KEY);

        // Filtra todos os projetos da conta que correspondem a este workspace (por ID salvo, URL Git, nome ou slug)
        const matchingProjects = existingProjects.filter((p) => {
            if (savedProjectId && p.id === savedProjectId) {
                return true;
            }
            const pUrl = this.normalizeGitUrl(p.repo_url);
            if (normalizedTargetUrl && pUrl && pUrl === normalizedTargetUrl) {
                return true;
            }
            const pName = this.normalizeIdentifier(p.name);
            const pSlug = this.normalizeIdentifier(p.slug || '');
            return pName === normalizedTargetName || pSlug === normalizedTargetName;
        });

        if (matchingProjects.length > 0) {
            // Ordena do mais antigo para o mais recente para manter o projeto original como principal
            matchingProjects.sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            const primaryProject = matchingProjects[0];
            const duplicateProjects = matchingProjects.slice(1);

            // Se já existiam projetos duplicados com o mesmo nome, migra/limpa as duplicatas
            for (const dup of duplicateProjects) {
                try {
                    const dupDocs = await this.api.listDocuments({ project_id: dup.id, limit: 200 });
                    const processedJobs = new Set<string>();
                    for (const doc of dupDocs) {
                        if (!processedJobs.has(doc.job_id)) {
                            await this.api.deleteJobRecord(doc.job_id);
                            processedJobs.add(doc.job_id);
                        }
                    }
                    await this.api.deleteProject(dup.id);
                } catch {
                    // Continua mesmo que uma duplicata antiga não possa ser removida
                }
            }

            // Atualiza o projeto existente via PATCH /v1/projects/{project_id}
            const updatedProject = await this.api.updateProject(primaryProject.id, {
                name: projectName,
                repo_url: repoUrl ?? primaryProject.repo_url,
                default_branch: defaultBranch ?? primaryProject.default_branch,
                description: `Atualizado via VS Code Extension em ${new Date().toLocaleString('pt-BR')}`
            });

            if (this.workspaceState) {
                await this.workspaceState.update(WORKSPACE_PROJECT_ID_KEY, updatedProject.id);
            }

            return { project: updatedProject, isExistingProject: true };
        }

        // Cria um novo projeto apenas se realmente não existir nenhum com este nome/repositório
        const newProject = await this.api.createProject({
            name: projectName,
            repo_url: repoUrl,
            default_branch: defaultBranch,
            description: 'Gerado via VS Code Extension'
        });

        if (this.workspaceState) {
            await this.workspaceState.update(WORKSPACE_PROJECT_ID_KEY, newProject.id);
        }

        return { project: newProject, isExistingProject: false };
    }

    /**
     * Coleta todos os arquivos de código válidos dentro do repositório local
     */
    private async collectSourceFiles(rootPath: string): Promise<Array<{ relativePath: string; content: string }>> {
        let allowedExtensions = DEFAULT_EXTENSIONS;

        try {
            const langs = await this.api.getSupportedLanguages();
            const apiExts = langs.flatMap((l) =>
                l.extensions.map((ext) => (ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`))
            );
            if (apiExts.length > 0) {
                allowedExtensions = new Set(apiExts);
            }
        } catch {
            // Mantém lista padrão caso a consulta de metadados falhe
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

            await new Promise((resolve) => setTimeout(resolve, 2500));
        }
    }

    /**
     * Sincroniza o projeto único na API, gera a documentação atualizada e substitui os registros antigos
     */
    async generateWorkspaceDocumentation(
        rootPath: string,
        exportFormat: 'markdown' | 'pdf',
        depth: GenerationDepth = 'standard'
    ): Promise<void> {
        // Atualiza e verifica o saldo na API antes de iniciar um novo Job
        const currentUsage = await this.api.getUsage();
        if (this.onUsageUpdated) {
            await this.onUsageUpdated();
        }
        if (currentUsage.exhausted) {
            const remainingCredits = Math.round((currentUsage.credits_remaining_brl || 0) * 100);
            throw new Error(
                `Saldo de créditos esgotado (${remainingCredits} créditos restantes). Recarregue sua conta para gerar novas documentações.`
            );
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Legacy Doc',
                cancellable: true
            },
            async (progress, cancellationToken) => {
                try {
                    const outputDir = path.join(rootPath, 'docs_legacydoc');
                    if (!fs.existsSync(outputDir)) {
                        fs.mkdirSync(outputDir, { recursive: true });
                    }

                    const oldConfigFile = path.join(outputDir, '.legacydoc.json');
                    if (fs.existsSync(oldConfigFile)) {
                        fs.unlinkSync(oldConfigFile);
                    }

                    progress.report({ message: 'Sincronizando projeto na API...' });
                    const { project, isExistingProject } = await this.resolveAndSyncProject(rootPath);

                    let previousDocs: DocumentSummaryResponse[] = [];
                    if (isExistingProject) {
                        try {
                            previousDocs = await this.api.listDocuments({
                                project_id: project.id,
                                limit: 200
                            });
                        } catch {
                            previousDocs = [];
                        }
                    }

                    progress.report({
                        message: isExistingProject
                            ? `Atualizando documentação do projeto "${project.name}"...`
                            : `Gerando documentação para o novo projeto "${project.name}"...`
                    });

                    const sourceFiles = await this.collectSourceFiles(rootPath);
                    if (sourceFiles.length === 0) {
                        vscode.window.showWarningMessage('Nenhum arquivo de código-fonte suportado foi encontrado na pasta.');
                        return;
                    }

                    const ext = exportFormat === 'pdf' ? 'pdf' : 'md';
                    let updatedCount = 0;
                    let createdCount = 0;
                    const oldJobIdsToDelete = new Set<string>();

                    for (let i = 0; i < sourceFiles.length; i++) {
                        const file = sourceFiles[i];
                        const stepLabel = `${i + 1}/${sourceFiles.length}: ${file.relativePath}`;

                        progress.report({
                            message: `${isExistingProject ? 'Atualizando' : 'Documentando'} ${stepLabel}...`
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

                        // Atualiza a barra de créditos em tempo real assim que o arquivo termina de ser processado
                        if (this.onUsageUpdated) {
                            await this.onUsageUpdated();
                        }

                        const newDocs = await this.api.listDocuments({
                            job_id: finishedJob.id,
                            project_id: project.id,
                            limit: 50
                        });

                        const matchingOldDocs = previousDocs.filter(
                            (oldDoc) =>
                                oldDoc.path.replace(/\\/g, '/') === file.relativePath &&
                                oldDoc.job_id !== finishedJob.id
                        );

                        for (const oldDoc of matchingOldDocs) {
                            oldJobIdsToDelete.add(oldDoc.job_id);
                        }

                        for (const docSummary of newDocs) {
                            const exportedBuffer = await this.api.exportDocument(docSummary.id, exportFormat);
                            const safeName = docSummary.path.replace(/[\\/]/g, '_');
                            const targetFile = path.join(outputDir, `${safeName}.${ext}`);

                            const existedBefore = fs.existsSync(targetFile) || matchingOldDocs.length > 0;
                            fs.writeFileSync(targetFile, exportedBuffer);

                            if (existedBefore) {
                                updatedCount++;
                            } else {
                                createdCount++;
                            }
                        }
                    }

                    if (oldJobIdsToDelete.size > 0) {
                        progress.report({ message: 'Limpando versões antigas substituídas...' });
                        for (const oldJobId of oldJobIdsToDelete) {
                            try {
                                await this.api.deleteJobRecord(oldJobId);
                            } catch {
                                // Ignora se já removido
                            }
                        }
                    }

                    if (isExistingProject || updatedCount > 0) {
                        vscode.window.showInformationMessage(
                            `Documentação do projeto "${project.name}" atualizada com sucesso! (${updatedCount + createdCount} arquivo(s) em "docs_legacydoc")`
                        );
                    } else {
                        vscode.window.showInformationMessage(
                            `Documentação do projeto "${project.name}" criada com sucesso! (${createdCount} arquivo(s) em "docs_legacydoc")`
                        );
                    }
                } finally {
                    // Garante que a barra de consumo reflita o estado mais recente da API ao encerrar
                    if (this.onUsageUpdated) {
                        await this.onUsageUpdated();
                    }
                }
            }
        );
    }
}