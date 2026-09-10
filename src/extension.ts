import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { exportMarkdown, exportPdf, loadWorkspaceContext, runDocumentationPipeline, scanWorkspace } from './documentation';

interface WorkspaceInfo {
	root: vscode.Uri;
	files: string[];
}

async function getGitWorkspace(): Promise<WorkspaceInfo | undefined> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {return undefined;}
	try {
		await fs.stat(path.join(folder.uri.fsPath, '.git'));
		const files = (await scanWorkspace(folder.uri.fsPath)).map((file) => file.relativePath);
		return {
			root: folder.uri,
			files: files.sort(),
		};
	} catch {
		return undefined;
	}
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const open = vscode.commands.registerCommand('legacy-doc.open', async () => {
		const panel = vscode.window.createWebviewPanel('legacyDoc', 'Legacy Doc', vscode.ViewColumn.One, { enableScripts: true });
		const workspace = await getGitWorkspace();
		if (!workspace) {
			panel.webview.html = renderHtml([], 'Abra uma pasta que contenha um repositório Git para começar.');
			return;
		}
		panel.webview.html = renderHtml(workspace.files, `Repositório detectado: ${path.basename(workspace.root.fsPath)}`);
		panel.webview.onDidReceiveMessage(async (message: { command: string; file: string }) => {
			if (!['markdown', 'pdf'].includes(message.command) || !workspace.files.includes(message.file)) {return;}
			try {
				await vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: 'Legacy Doc',
					cancellable: false,
				}, async (progress) => {
					const code = await fs.readFile(path.join(workspace.root.fsPath, message.file), 'utf8');
					const workspaceContext = await loadWorkspaceContext(workspace.root.fsPath);
					let lastProgress = 0;
					const result = await runDocumentationPipeline(message.file, code, workspaceContext, (step, value) => {
						progress.report({ message: step, increment: Math.max(0, value - lastProgress) });
						lastProgress = value;
					});
					if (!result.verifier.approved) {
						vscode.window.showWarningMessage(`Legacy Doc: o Verifier encontrou pontos de atenção. ${result.verifier.feedback_message}`);
					}
					progress.report({ message: 'Export: gravando documentação', increment: 10 });
					const outputPath = message.command === 'markdown'
						? await exportMarkdown(workspace.root.fsPath, message.file, result.documentation)
						: await exportPdf(workspace.root.fsPath, message.file, result.documentation);
					const document = await vscode.workspace.openTextDocument(outputPath);
					await vscode.window.showTextDocument(document, { preview: false });
					vscode.window.showInformationMessage(`Legacy Doc: ${path.basename(outputPath)} gerado.`);
				});
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Legacy Doc não conseguiu gerar a documentação: ${reason}`);
			}
		}, undefined, context.subscriptions);
	});
	context.subscriptions.push(open);
}

export function deactivate(): void {}

function renderHtml(files: string[], status: string): string {
	const options = files.length
		? files.map((file) => `<option value="${escapeHtml(file)}">${escapeHtml(file)}</option>`).join('')
		: '<option>Nenhum arquivo C/C++ encontrado</option>';
	return `<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><style>
	:root{color-scheme:dark}body{font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-foreground);padding:32px;max-width:760px;margin:auto}h1{color:#4ea1ff;font-size:28px}p{color:var(--vscode-descriptionForeground)}.card{border:1px solid var(--vscode-panel-border);border-radius:10px;padding:24px;background:var(--vscode-sideBar-background)}select,button{font:inherit;border-radius:6px;padding:10px 14px;margin:8px 8px 0 0}button{border:0;background:#1677d2;color:#fff;cursor:pointer}button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}button:disabled{opacity:.5;cursor:not-allowed}.tag{color:#7bd88f;font-size:13px}
	</style></head><body><div class="tag">LEGACY DOC · DOCUMENTAÇÃO TÉCNICA</div><h1>Transforme código legado em conhecimento</h1><p>${escapeHtml(status)}</p><div class="card"><label for="file">Arquivo C/C++</label><br><select id="file" ${files.length ? '' : 'disabled'}>${options}</select><br><button id="markdown" ${files.length ? '' : 'disabled'}>Gerar Markdown</button><button id="pdf" class="secondary" ${files.length ? '' : 'disabled'}>Gerar PDF</button></div><script>
	const vscode=acquireVsCodeApi(); const file=document.getElementById('file'); document.getElementById('markdown').onclick=()=>vscode.postMessage({command:'markdown',file:file.value}); document.getElementById('pdf').onclick=()=>vscode.postMessage({command:'pdf',file:file.value});
	</script></body></html>`;
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}
