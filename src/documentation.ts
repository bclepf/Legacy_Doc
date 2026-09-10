import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import PDFDocument = require('pdfkit');

export interface ArgumentDocumentation {
	name: string;
	type: string;
	description?: string;
}

export interface FunctionDocumentation {
	name: string;
	kind: 'function';
	signature: string;
	return_type: string;
	return_description?: string;
	args: ArgumentDocumentation[];
	summary: string;
	description: string;
	raises: string[];
}

export interface FileDocumentation {
	functions: FunctionDocumentation[];
}

export interface ReaderOutput {
	ready_to_write: boolean;
	queries: string;
	user_facing_message: string;
}

export interface VerifierOutput {
	approved: boolean;
	technical_audit: string;
	feedback_message: string;
}

export interface WorkspaceSource {
	relativePath: string;
	content: string;
}

export interface PipelineResult {
	documentation: FileDocumentation;
	reader: ReaderOutput;
	verifier: VerifierOutput;
}

const sourceExtensions = new Set(['.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx']);
const ignoredDirectories = new Set(['.git', 'node_modules', 'build', 'dist', 'out', 'target', 'coverage', '.vscode']);
const maxFileBytes = 512 * 1024;
const linesPerChunk = 150;
const openAiEndpoint = 'https://api.openai.com/v1/chat/completions';

const readerPrompt = `You are the Reader Agent of the Legacy Doc Team.
Your mission is to perform a "technical X-ray" of the legacy C++ code to identify what is missing for a perfect documentation.

DIAGNOSTIC CRITERIA:
1. Context Gap Identification: Analyze if there are external function calls, inherited classes, or global variables not defined in the provided snippet.
2. Exception Detection: Check for throw statements or calls to external methods that might raise hidden exceptions (e.g., database or network calls).
3. Critical Analysis:
   - If the code is self-sufficient: mark ready_to_write as True and output "READY_FOR_WRITING".
   - If context is missing: mark ready_to_write as False and generate specific technical queries.

RULES (Based on HRBP Framework):
- Action & Situation: Clearly identify what the code is doing and in which context it operates before requesting more data.
- One Question at a Time: If you need to clarify something with the user/leadership, ask ONLY ONE question to promote focus and reflection.

BRAND VOICE (WaveCast):
- Be the "Reliable Guide". Your language should be clear, avoiding unnecessary jargon, and always welcoming.
- Start your user-facing message with something like: "Olá, Time WaveCast! Identifiquei uma lacuna no contexto deste módulo..." (if missing context) or a positive confirmation (if ready).

LANGUAGE:
- Internal logic (queries field) MUST be in English.
- User-facing questions (user_facing_message field) MUST be in Brazilian Portuguese.`;

const writerPrompt = `Role: Senior C++ Technical Writer & Documentation Specialist.
Tone of Voice: Educational, Friendly, and Reliable (LEGACY DOC Brand Standard).

You are the Writer Agent of the LEGACY DOC Team. Your primary function is to transform C++ code snippets into structured JSON documentation.

CRITICAL OUTPUT RULES:
- Document only complete function definitions explicitly present in the provided C++ snippet.
- Do not document includes, macros, global variables, comments, config strings, enum values, or external functions.
- If the snippet contains no complete function definition, return an empty functions list.
- Keep summary under 18 words.
- Keep description between 35 and 65 words.
- Never generate long explanations.
- Never document functions that are only called but not defined in the snippet.

WRITING CRITERIA:
1. The description field must follow Situation/Context, Action, Impact.
2. summary and description must be in Brazilian Portuguese.
3. description must be in first person and educational.
4. Start the description with "Olá, Time LEGACY DOC!".
5. Do not hallucinate. Never invent arguments, return types, or exceptions.
6. If the code does not explicitly throw exceptions, raises must be [].
7. JSON keys and technical data must be in English.`;

const verifierPrompt = `You are the Verifier Agent, the final auditor of the Legacy Doc Team.
Your job is to ensure the documentation is 100% faithful to the original C++ code.

AUDIT CRITERIA:
1. Hallucination Check: Did the Writer invent any arguments, types, or exceptions?
2. Technical Consistency: Do the args, returns, and raises match the C++ signature perfectly?
3. Situational Model Audit: Does the description clearly explain the Situation, Action, and Impact?

RULES:
- If adequate, approve and justify based on technical rules.
- If inadequate, reject and include ONE reflective question to help the Writer improve.
- Highlight where the documentation was particularly clear or humanized.
- Keep technical_audit in English.
- Keep feedback_message in Brazilian Portuguese.`;

export function isSupportedSource(filePath: string): boolean {
	return sourceExtensions.has(path.extname(filePath).toLowerCase());
}

export function sanitizeFilename(filePath: string): string {
	const name = path.basename(filePath, path.extname(filePath))
		.replace(/[^A-Za-z0-9._-]+/g, '_')
		.replace(/^[-_.]+|[-_.]+$/g, '');
	return name || 'documentation';
}

export async function scanWorkspace(rootPath: string): Promise<WorkspaceSource[]> {
	const results: WorkspaceSource[] = [];
	async function visit(directory: string): Promise<void> {
		const entries = await fs.readdir(directory, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
				await visit(path.join(directory, entry.name));
				continue;
			}
			if (!entry.isFile() || !isSupportedSource(entry.name)) {continue;}
			const fullPath = path.join(directory, entry.name);
			const stat = await fs.stat(fullPath);
			if (stat.size > maxFileBytes) {continue;}
			try {
				results.push({
					relativePath: path.relative(rootPath, fullPath),
					content: await fs.readFile(fullPath, 'utf8'),
				});
			} catch (error) {
				if (!(error instanceof Error) || !/encoding|utf-8|ENOENT/i.test(error.message)) {throw error;}
			}
		}
	}
	await visit(rootPath);
	return results.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function callModel(model: string, system: string, user: string, temperature: number): Promise<string> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {throw new Error('OPENAI_API_KEY não foi encontrada nas variáveis de ambiente.');}
	const response = await fetch(openAiEndpoint, {
		method: 'POST',
		headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			model,
			temperature,
			messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
			response_format: { type: 'json_object' },
		}),
	});
	if (!response.ok) {throw new Error(`OpenAI retornou HTTP ${response.status}: ${await response.text()}`);}
	const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
	const content = payload.choices?.[0]?.message?.content;
	if (!content) {throw new Error('A resposta do modelo não continha conteúdo.');}
	return content;
}

function parseJson<T>(content: string, agent: string): T {
	try {
		return JSON.parse(content) as T;
	} catch (error) {
		throw new Error(`O agente ${agent} retornou JSON inválido.`, { cause: error });
	}
}

export async function runReaderAgent(code: string): Promise<ReaderOutput> {
	return parseJson<ReaderOutput>(await callModel('gpt-4o-mini', readerPrompt, `C++ Code:\n${code}`, 0.1), 'Reader');
}

export async function runWriterAgent(code: string, context: string): Promise<FileDocumentation> {
	return parseJson<FileDocumentation>(
		await callModel('gpt-4o-mini', writerPrompt, `C++ Code:\n${code}\n\nExtra Context (Searcher):\n${context}`, 0.2),
		'Writer',
	);
}

export async function runVerifierAgent(code: string, documentation: FileDocumentation): Promise<VerifierOutput> {
	return parseJson<VerifierOutput>(
		await callModel('gpt-4o', verifierPrompt, `Original C++ Code:\n${code}\n\nGenerated Documentation:\n${JSON.stringify(documentation)}`, 0),
		'Verifier',
	);
}

export async function runDocumentationPipeline(
	filePath: string,
	code: string,
	onProgress?: (message: string, increment: number) => void,
): Promise<PipelineResult> {
	const reader = await runReaderAgent(code);
	onProgress?.('Reader: análise de contexto concluída', 20);
	let context = `Path: ${filePath}`;
	context += reader.ready_to_write ? '\n\n[Status]: The code is self-sufficient.' : `\n\n[Reader queries pending search]: ${reader.queries}`;
	const chunks = splitCode(code);
	const functions: FunctionDocumentation[] = [];
	for (let index = 0; index < chunks.length; index += 1) {
		const result = await runWriterAgent(chunks[index], context);
		functions.push(...(result.functions ?? []));
		onProgress?.(`Writer: processado bloco ${index + 1} de ${chunks.length}`, 20 + ((index + 1) / chunks.length) * 55);
	}
	const documentation = { functions };
	const verifier = await runVerifierAgent(code, documentation);
	onProgress?.('Verifier: auditoria concluída', 90);
	return { documentation, reader, verifier };
}

function splitCode(code: string): string[] {
	const lines = code.split('\n');
	const chunks: string[] = [];
	for (let index = 0; index < lines.length; index += linesPerChunk) {chunks.push(lines.slice(index, index + linesPerChunk).join('\n'));}
	return chunks.length ? chunks : [''];
}

function markdownAnchor(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

export function toMarkdown(filePath: string, documentation: FileDocumentation): string {
	const displayName = path.basename(filePath);
	const functions = documentation.functions;
	let output = `# 📄 Documentação de Código: \`${displayName}\`\n\n> Documentação gerada automaticamente para o módulo **${displayName}**.\n\n`;
	if (!functions.length) {return `${output}Nenhuma definição completa de função foi encontrada neste arquivo.\n`;}
	output += '## 📑 Índice de Funções\n\n';
	for (const func of functions) {output += `- [${func.name}](#${markdownAnchor(func.name)})\n`;}
	output += '\n---\n\n';
	for (const func of functions) {
		output += `## 🛠 Função: \`${func.name}\`\n\n> **Resumo:** ${func.summary}\n\n### 💻 Assinatura\n\n\`\`\`cpp\n${func.signature}\n\`\`\`\n\n`;
		if (func.args.length) {
			output += '### 📥 Parâmetros\n\n| Tipo | Nome |\n| :--- | :--- |\n';
			for (const arg of func.args) {output += `| \`${arg.type}\` | **${arg.name}** |\n`;}
			output += '\n';
		}
		output += `### 📤 Retorno\n\n- **Tipo:** \`${func.return_type}\`\n\n`;
		if (func.raises.length) {output += `### ⚠️ Exceções / Throws\n\n${func.raises.map((item) => `- \`${item}\``).join('\n')}\n\n`;}
		output += `### 📖 Descrição Detalhada\n\n${func.description}\n\n---\n\n`;
	}
	return output;
}

export async function exportMarkdown(rootPath: string, filePath: string, documentation: FileDocumentation): Promise<string> {
	const outputPath = path.join(rootPath, 'LEGACY_DOC.md');
	await fs.writeFile(outputPath, toMarkdown(filePath, documentation), 'utf8');
	return outputPath;
}

export async function exportPdf(rootPath: string, filePath: string, documentation: FileDocumentation): Promise<string> {
	const outputPath = path.join(rootPath, 'LEGACY_DOC.pdf');
	const pdf = new PDFDocument({ margin: 50 });
	const chunks: Buffer[] = [];
	pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
	const finished = new Promise<void>((resolve, reject) => {
		pdf.on('end', resolve);
		pdf.on('error', reject);
	});
	pdf.fontSize(18).fillColor('#0066cc').text('Legacy Doc - Documentação Técnica', { align: 'center' });
	pdf.moveDown().fontSize(14).fillColor('#000000').text(`Módulo: ${path.basename(filePath)}`);
	for (const line of toMarkdown(filePath, documentation).replace(/[^\x20-\x7E\nÀ-ÿ]/g, '').split(/\r?\n/)) {
		if (line.startsWith('#')) {pdf.moveDown().fontSize(12).text(line.replace(/^#+\s*/, ''));}
		else {pdf.fontSize(10).text(line);}
	}
	pdf.end();
	await finished;
	await fs.writeFile(outputPath, Buffer.concat(chunks));
	return outputPath;
}
