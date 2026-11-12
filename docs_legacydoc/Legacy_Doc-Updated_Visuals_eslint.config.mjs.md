# `Legacy_Doc-Updated_Visuals/eslint.config.mjs`

> Linguagem: **javascript** · Simbolos documentados: **1**


O arquivo eslint.config.mjs é responsável por configurar o ESLint, uma ferramenta de linting para JavaScript e TypeScript. Ele define as regras e opções específicas para garantir a qualidade e a consistência do código TypeScript dentro do projeto.


## Indice

- [`default`](#default) — Configuração do ESLint para arquivos TypeScript.


---

## `default`

*function · linhas 1–14 · complexidade ~2*

> Configuração do ESLint para arquivos TypeScript.

```JavaScript
export default [{ files: ["**/*.ts"] }, { plugins: { "@typescript-eslint": typescriptEslint.plugin, }, languageOptions: { parser: typescriptEslint.parser, ecmaVersion: 2022, sourceType: "module", }, rules: { "@typescript-eslint/naming-convention": ["warn", { selector: "import", format: ["camelCase", "PascalCase"] }], curly: "warn", eqeqeq: "warn", "no-throw-literal": "warn", semi: "warn", }, }];
```

### Retorno

- **Tipo:** `null`

### Descricao

Esta configuração do ESLint é aplicada a arquivos TypeScript. Ela define plugins, opções de linguagem e regras específicas para garantir a qualidade do código. As regras incluem convenções de nomenclatura, uso de chaves, comparação estrita e uso de ponto e vírgula, promovendo um código mais consistente e menos propenso a erros.
