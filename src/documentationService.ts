import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import AdmZip from 'adm-zip';
import { LegacyDocApiClient } from './apiClient';
import { GenerationDepth, JobResponse } from './types/api';

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.venv', 'venv', '__pycache__', '.idea', '.vscode']);

export class DocumentationService {
    constructor(private api: LegacyDocApiClient) {}

    /**
     * Compacta a pasta aberta no VS Code em um Buffer .zip em memória
     */
    private createWorkspaceZip(rootPath: string): Buffer {
        const zip = new AdmZip();

        const addDirectoryToZip = (currentPath: string, zipPath: string) => {
            const entries = fs.readdirSync(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                if (IGNORED_DIRS.has(entry.name)) {
                    continue;
                }
                const fullPath = path.join(currentPath, entry.name);
                const entryZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;

                if (entry.isDirectory()) {
                    addDirectoryToZip(fullPath, entryZipPath);
                } else if (entry.isFile()) {
                    // Evita adicionar arquivos de documentação gerados anteriormente
                    if (entry.name.startsWith('LEGACY_DOC.')) {
                        continue;
                    }
                    zip.addFile(entryZipPath, fs.readFileSync(fullPath));
                }
            }
        };

        addDirectoryToZip(rootPath, '');
        return zip.toBuffer();
    }

    /**
     * Aguarda a conclusão do Job consultando GET /v1/jobs/{id} a cada 3 segundos
     */
    private async pollJobUntilFinished(
        jobId: string,
        progress: vscode.Progress<{ message?: string; increment?: number }>,
        token: vscode.CancellationToken
    ): Promise<JobResponse> {
        let lastPercent = 0;

        while (true) {
            if (token.isCancellationRequested) {
                await this.api.cancelJob(jobId);
                throw new Error('Operação cancelada pelo usuário.');
            }

            const job = await this.api.getJob(jobId);
            const increment = Math.max(0, job.progress_percent - lastPercent);
            lastPercent = job.progress_percent;

            progress.report({
                message: job.progress_message || `Status: ${job.status} (${job.progress_percent}%)`,
                increment
            });

            if (job.status === 'completed' || job.status === 'succeeded' || job.status === 'done') {
                return job;
            }

            if (job.status === 'failed' || job.status === 'error' || job.status === 'cancelled') {
                throw new Error(job.error_message || `O Job falhou com status: ${job.status}`);
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    /**
     * Fluxo completo: Compacta repositório local -> Cria Job -> Faz Polling -> Exporta .md ou .pdf na pasta
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
                progress.report({ message: 'Compactando arquivos do repositório local...' });
                const zipBuffer = this.createWorkspaceZip(rootPath);
                const repoName = `${path.basename(rootPath)}.zip`;

                progress.report({ message: 'Enviando código para a fila de análise...' });
                const job = await this.api.createUploadJob(zipBuffer, repoName, {
                    output_language: 'pt-BR',
                    depth
                });

                const finishedJob = await this.pollJobUntilFinished(job.id, progress, cancellationToken);

                progress.report({ message: 'Baixando e exportando documentação...' });
                const docs = await this.api.listDocuments({ job_id: finishedJob.id, limit: 200 });

                if (docs.length === 0) {
                    vscode.window.showWarningMessage('O processamento foi concluído, mas nenhum documento foi retornado.');
                    return;
                }

                // Se for Markdown e houver múltiplos arquivos documentados, podemos consolidar ou exportar cada um
                const ext = exportFormat === 'pdf' ? 'pdf' : 'md';
                const outputDir = path.join(rootPath, 'docs_legacydoc');
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }

                for (const docSummary of docs) {
                    const exportedBuffer = await this.api.exportDocument(docSummary.id, exportFormat);
                    const safeName = docSummary.path.replace(/[\\/]/g, '_');
                    const targetFile = path.join(outputDir, `${safeName}.${ext}`);
                    fs.writeFileSync(targetFile, exportedBuffer);
                }

                vscode.window.showInformationMessage(
                    `Documentação gerada com sucesso! (${docs.length} arquivo(s) salvos em /docs_legacydoc)`
                );
            }
        );
    }
}