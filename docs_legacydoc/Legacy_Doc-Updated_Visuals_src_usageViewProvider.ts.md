# `Legacy_Doc-Updated_Visuals/src/usageViewProvider.ts`

> Linguagem: **typescript** · Simbolos documentados: **10**


O arquivo `usageViewProvider.ts` é responsável por fornecer uma visualização do uso da API dentro do sistema. Ele contém a classe `UsageViewProvider`, que gerencia a renderização de dados de uso, incluindo a atualização e limpeza dessas informações. Além disso, o arquivo implementa métodos para lidar com estados de carregamento e erro, bem como para atualizar a barra de status relacionada ao uso da API.


## Indice

- [`UsageViewProvider`](#usageviewprovider) — Classe que fornece a visualização do uso da API.
- [`constructor`](#constructor) — Construtor da classe UsageViewProvider.
- [`resolveWebviewView`](#resolvewebviewview) — Resolve a visualização do webview.
- [`refresh`](#refresh) — Atualiza os dados de uso da API.
- [`clear`](#clear) — Limpa os dados de uso e a visualização.
- [`dispose`](#dispose) — Desfaz a barra de status.
- [`updateStatusBar`](#updatestatusbar) — Atualiza a barra de status com informações de uso.
- [`renderLoading`](#renderloading) — Renderiza uma tela de carregamento.
- [`renderError`](#rendererror) — Renderiza uma mensagem de erro no webview.
- [`renderUsage`](#renderusage) — Renderiza os dados de uso no webview.


---

## `UsageViewProvider`

*class · linhas 5–230*

> Classe que fornece a visualização do uso da API.

```typescript
class UsageViewProvider implements vscode.WebviewViewProvider
```

### Descricao

A classe UsageViewProvider implementa a interface vscode.WebviewViewProvider para gerenciar a exibição do uso da API. Ela inicializa um item de barra de status e fornece métodos para resolver a visualização, atualizar o status e renderizar informações sobre o uso, incluindo erros e carregamento.


---

## `constructor`

*method · em `UsageViewProvider` · linhas 11–15 · complexidade ~1*

> Construtor da classe UsageViewProvider.

```typescript
constructor(private api: LegacyDocApiClient)
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `api` | `LegacyDocApiClient` | Cliente da API de documentos legados. |

### Descricao

O construtor inicializa a classe UsageViewProvider, criando um item de barra de status e configurando seu comando e tooltip. Ele recebe uma instância de LegacyDocApiClient para interagir com a API de documentos legados.


---

## `resolveWebviewView`

*method · em `UsageViewProvider` · linhas 17–33 · complexidade ~3*

> Resolve a visualização do webview.

```typescript
public resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `webviewView` | `vscode.WebviewView` | A visualização do webview a ser resolvida. |
| `_context` | `vscode.WebviewViewResolveContext` | O contexto da resolução da visualização. |
| `_token` | `vscode.CancellationToken` | Token de cancelamento para a operação. |

### Retorno

- **Tipo:** `void`

### Descricao

O método resolveWebviewView é chamado para configurar a visualização do webview. Ele define as opções do webview e renderiza o uso anterior ou uma tela de carregamento, dependendo da disponibilidade dos dados de uso.


---

## `refresh`

*method · em `UsageViewProvider` · linhas 38–50 · complexidade ~3*

> Atualiza os dados de uso da API.

```typescript
public async refresh(): Promise<UsageResponse | undefined>
```

### Retorno

- **Tipo:** `Promise<UsageResponse | undefined>`
- Retorna os dados de uso ou undefined em caso de erro.

### Descricao

O método refresh chama a API para obter os dados de uso e atualiza a visualização e a barra de status com as informações recebidas. Em caso de erro, renderiza uma mensagem de erro e oculta a barra de status.


---

## `clear`

*method · em `UsageViewProvider` · linhas 55–61 · complexidade ~2*

> Limpa os dados de uso e a visualização.

```typescript
public clear(): void
```

### Retorno

- **Tipo:** `void`

### Descricao

O método clear redefine os dados de uso armazenados e oculta o item da barra de status. Se a visualização estiver disponível, também limpa o conteúdo HTML do webview.


---

## `dispose`

*method · em `UsageViewProvider` · linhas 63–65 · complexidade ~1*

> Desfaz a barra de status.

```typescript
public dispose(): void
```

### Retorno

- **Tipo:** `void`

### Descricao

O método dispose libera os recursos associados ao item da barra de status, garantindo que não haja vazamentos de memória quando a visualização não for mais necessária.


---

## `updateStatusBar`

*method · em `UsageViewProvider` · linhas 67–76 · complexidade ~3*

> Atualiza a barra de status com informações de uso.

```typescript
private updateStatusBar(usage: UsageResponse): void
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `usage` | `UsageResponse` | Dados de uso a serem exibidos na barra de status. |

### Retorno

- **Tipo:** `void`

### Descricao

O método updateStatusBar modifica o texto e o ícone do item da barra de status com base nos dados de uso fornecidos. Ele exibe informações sobre créditos restantes e percentual de uso.


---

## `renderLoading`

*method · em `UsageViewProvider` · linhas 78–90 · complexidade ~2*

> Renderiza uma tela de carregamento.

```typescript
private renderLoading(): void
```

### Retorno

- **Tipo:** `void`

### Descricao

O método renderLoading exibe uma mensagem de carregamento no webview, informando ao usuário que os dados estão sendo carregados. Ele não faz alterações se a visualização não estiver disponível.


---

## `renderError`

*method · em `UsageViewProvider` · linhas 92–104 · complexidade ~2*

> Renderiza uma mensagem de erro no webview.

```typescript
private renderError(message: string): void
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `message` | `string` | Mensagem de erro a ser exibida. |

### Retorno

- **Tipo:** `void`

### Descricao

O método renderError exibe uma mensagem de erro no webview quando ocorre uma falha ao obter os dados de uso. Ele não faz alterações se a visualização não estiver disponível.


---

## `renderUsage`

*method · em `UsageViewProvider` · linhas 106–229 · complexidade ~5*

> Renderiza os dados de uso no webview.

```typescript
private renderUsage(usage: UsageResponse): void
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `usage` | `UsageResponse` | Dados de uso a serem exibidos no webview. |

### Retorno

- **Tipo:** `void`

### Descricao

O método renderUsage exibe as informações de uso da API no webview, incluindo créditos restantes, percentual de uso e status. Ele não faz alterações se a visualização não estiver disponível.
