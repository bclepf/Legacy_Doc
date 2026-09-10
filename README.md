# Legacy Doc

Legacy Doc converts C/C++ source files in the current Git workspace into technical documentation, based on the Reader/Writer/Verifier and exporter workflow from [sawneon/legacydoc](https://github.com/sawneon/legacydoc).

## Usage

1. Open a folder containing a Git repository in VS Code.
2. Run **Legacy Doc: Documentar repositório** from the Command Palette.
3. Select a C/C++ file and choose **Gerar Markdown** or **Gerar PDF**.

Generated files are written as `LEGACY_DOC.md` and `LEGACY_DOC.pdf` at the workspace root. The extension detects `.git` automatically; no repository URL or external server is required.

## AI configuration

The multi-agent pipeline uses the same models as the Python application: `gpt-4o-mini` (Reader and Writer) and `gpt-4o` (Verifier). Set `OPENAI_API_KEY` in the environment before launching VS Code. The key is never written to the workspace.

## Supported source files

`.c`, `.cc`, `.cpp`, `.cxx`, `.h`, `.hh`, `.hpp`, and `.hxx`.

The local analyzer documents complete function definitions, preserving signatures, parameters, return types, and explicit `throw` expressions. It intentionally does not require an API key.

## Development

```bash
npm install
npm run compile
```
