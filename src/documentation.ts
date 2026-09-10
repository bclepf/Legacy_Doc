import * as path from 'node:path';

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

const functionPattern = /(?:^|\n)\s*(?:(?:template\s*<[\s\S]*?>)\s*)?(?:(?:inline|static|virtual|constexpr|explicit|extern|friend)\s+)*(?<returnType>[A-Za-z_][\w:\s*&<>,~]*?)\s+(?<name>[A-Za-z_]\w*(?:::\w+)*)\s*\((?<parameters>[^)]*)\)\s*(?:const\s*)?(?:noexcept\s*)?(?:\{|$)/gm;
const sourceExtensions = new Set(['.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx']);

export function isSupportedSource(filePath: string): boolean {
	return sourceExtensions.has(path.extname(filePath).toLowerCase());
}

export function sanitizeFilename(filePath: string): string {
	const name = path.basename(filePath, path.extname(filePath))
		.replace(/[^A-Za-z0-9._-]+/g, '_')
		.replace(/^[-_.]+|[-_.]+$/g, '');
	return name || 'documentation';
}

function splitArguments(parameters: string): ArgumentDocumentation[] {
	if (!parameters.trim() || parameters.trim() === 'void') {
		return [];
	}

	return parameters.split(',').map((parameter) => {
		const normalized = parameter.trim().replace(/\s+/g, ' ');
		const withoutDefault = normalized.split('=')[0].trim();
		const match = /^(?<type>.+?)\s+(?<name>[A-Za-z_]\w*(?:\s*\[\])?)$/.exec(withoutDefault);
		if (!match?.groups) {
			return { name: withoutDefault || 'unnamed', type: withoutDefault || 'unknown' };
		}
		return { name: match.groups.name, type: match.groups.type };
	});
}

function findClosingBrace(code: string, openBrace: number): number {
	let depth = 0;
	for (let index = openBrace; index < code.length; index += 1) {
		if (code[index] === '{') {depth += 1;}
		if (code[index] === '}') {
			depth -= 1;
			if (depth === 0) {return index;}
		}
	}
	return code.length - 1;
}

export function documentSource(filePath: string, code: string): FileDocumentation {
	const functions: FunctionDocumentation[] = [];
	let match: RegExpExecArray | null;
	while ((match = functionPattern.exec(code)) !== null) {
		const groups = match.groups;
		if (!groups) {continue;}
		const openBrace = code.indexOf('{', match.index + match[0].length - 1);
		if (openBrace < 0) {continue;}
		const body = code.slice(openBrace, findClosingBrace(code, openBrace) + 1);
		const name = groups.name.split('::').pop() ?? groups.name;
		const returnType = groups.returnType.trim().replace(/\s+/g, ' ');
		const args = splitArguments(groups.parameters);
		const signature = `${returnType} ${groups.name}(${groups.parameters.trim()})`;
		const raises = [...body.matchAll(/\bthrow\s+(?:std::)?([A-Za-z_]\w*)/g)].map((item) => item[1]);
		functions.push({
			name,
			kind: 'function',
			signature,
			return_type: returnType,
			args,
			summary: `Implementa a função ${name} no módulo ${path.basename(filePath)}.`,
			description: `Olá, Time LEGACY DOC! Nesta função, recebo ${args.length ? 'os parâmetros declarados e ' : ''}executo a lógica definida no código. O resultado é a aplicação desse comportamento no módulo, mantendo a assinatura e os efeitos observáveis originais.`,
			raises,
		});
	}
	return { functions };
}

function markdownAnchor(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

export function toMarkdown(filePath: string, documentation: FileDocumentation): string {
	const displayName = path.basename(filePath);
	const functions = documentation.functions;
	let output = `# 📄 Documentação de Código: \`${displayName}\`\n\n`;
	output += `> Documentação gerada automaticamente para o módulo **${displayName}**.\n\n`;
	if (!functions.length) {return `${output}Nenhuma definição completa de função foi encontrada neste arquivo.\n`;}
	output += '## 📑 Índice de Funções\n\n';
	for (const func of functions) {output += `- [${func.name}](#${markdownAnchor(func.name)})\n`;}
	output += '\n---\n\n';
	for (const func of functions) {
		output += `## 🛠 Função: \`${func.name}\`\n\n> **Resumo:** ${func.summary}\n\n`;
		output += `### 💻 Assinatura\n\n\`\`\`cpp\n${func.signature}\n\`\`\`\n\n`;
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

function pdfEscape(value: string): string {
	return value.replace(/[^\x20-\x7E\n]/g, '?').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function toPdf(filePath: string, documentation: FileDocumentation): Uint8Array {
	const lines = toMarkdown(filePath, documentation).replace(/[`*_#>|📄📑🛠💻📥📤⚠️📖]/g, '').split(/\r?\n/);
	const pages: string[][] = [];
	for (let index = 0; index < lines.length; index += 45) {pages.push(lines.slice(index, index + 45));}
	if (!pages.length) {pages.push(['No documentation generated.']);}
	const objects: string[] = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [' + pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ') + `] /Count ${pages.length} >>`,
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
	];
	for (let index = 0; index < pages.length; index += 1) {
		const content = pages[index].map((line, lineIndex) => `BT /F1 10 Tf 40 ${770 - lineIndex * 16} Td (${pdfEscape(line.slice(0, 110))}) Tj ET`).join('\n');
		objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`);
		objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
	}
	let pdf = '%PDF-1.4\n';
	const offsets: number[] = [0];
	for (let index = 0; index < objects.length; index += 1) {
		offsets.push(pdf.length);
		pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
	}
	const xref = pdf.length;
	pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (let index = 1; index < offsets.length; index += 1) {pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;}
	pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
	return new TextEncoder().encode(pdf);
}
