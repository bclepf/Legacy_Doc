import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { LegacyDocApiClient } from './apiClient';
import { GenerationDepth, JobResponse } from './types/api';

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
     * Coleta todos os arquivos de código válidos dentro do repositório local
     */
    private async collectSourceFiles(rootPath: string): Promise<Array<{ relativePath: string; content: string }>> {
        let allowedExtensions = DEFAULT_EXTENSIONS;

        try {
            const langs = await this.api.getSupportedLanguages();
            const apiExts = langs.flatMap(l => l.extensions.map(ext => ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`));
            if (apiExts.length > 0) {
                allowedExtensions = new Set(apiExts);
            }
        } catch {
            // Mantém a lista padrão caso a chamada de metadados falhe
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
     * Envia os arquivos locais via document_snippet e salva o resultado (.md ou .pdf) na pasta do projeto
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
                progress.report({ message: 'Lendo arquivos de código do repositório...' });
                const sourceFiles = await this.collectSourceFiles(rootPath);

                if (sourceFiles.length === 0) {
                    vscode.window.showWarningMessage('Nenhum arquivo de código-fonte suportado foi encontrado na pasta.');
                    return;
                }

                const ext = exportFormat === 'pdf' ? 'pdf' : 'md';
                const outputDir = path.join(rootPath, 'docs_legacydoc');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                let totalSaved = 0;

                for (let i = 0; i < sourceFiles.length; i++) {
                    const file = sourceFiles[i];
                    const stepLabel = `${i + 1}/${sourceFiles.length}: ${file.relativePath}`;

                    progress.report({ message: `Enviando ${stepLabel}...` });

                    // Usa document_snippet (envia o código direto no JSON sem depender de disco temporário no servidor)
                    const job = await this.api.createJob({
                        job_type: 'document_snippet',
                        path: file.relativePath,
                        content: file.content,
                        output_language: 'pt-BR',
                        depth
                    });

                    const finishedJob = await this.pollJobUntilFinished(
                        job.id,
                        stepLabel,
                        progress,
                        cancellationToken
                    );

                    progress.report({ message: `Exportando ${file.relativePath} para .${ext}...` });
                    const docs = await this.api.listDocuments({ job_id: finishedJob.id, limit: 50 });

                    for (const docSummary of docs) {
                        const exportedBuffer = await this.api.exportDocument(docSummary.id, exportFormat);
                        const safeName = docSummary.path.replace(/[\\/]/g, '_');
                        const targetFile = path.join(outputDir, `${safeName}.${ext}`);
                        fs.writeFileSync(targetFile, exportedBuffer);
                        totalSaved++;
                    }
                }

                vscode.window.showInformationMessage(
                    `Documentação concluída! ${totalSaved} arquivo(s) salvo(s) na pasta "docs_legacydoc".`
                );
            }
        );
    }
}