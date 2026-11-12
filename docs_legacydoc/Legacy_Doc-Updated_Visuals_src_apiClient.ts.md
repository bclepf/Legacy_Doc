# `Legacy_Doc-Updated_Visuals/src/apiClient.ts`

> Linguagem: **typescript** · Simbolos documentados: **33**


O arquivo `apiClient.ts` é responsável por fornecer uma interface para interagir com a API do Legacy Doc. Ele contém a classe `LegacyDocApiClient`, que inclui métodos para autenticação, gerenciamento de usuários, manipulação de projetos e trabalhos, além de operações relacionadas a documentos. Através de seus métodos, é possível realizar ações como registrar usuários, criar e listar projetos, e verificar a saúde da API.


## Indice

- [`LegacyDocApiClient`](#legacydocapiclient) — Classe para interagir com a API do Legacy Doc.
- [`constructor`](#constructor) — Construtor da classe LegacyDocApiClient.
- [`setToken`](#settoken) — Armazena um token de autenticação.
- [`getToken`](#gettoken) — Recupera o token de autenticação armazenado.
- [`clearToken`](#cleartoken) — Remove o token de autenticação armazenado.
- [`request`](#request) — Faz uma requisição para a API.
- [`register`](#register) — Registra um novo usuário na API.
- [`login`](#login) — Realiza o login de um usuário na API.
- [`getMe`](#getme) — Obtém informações sobre o usuário autenticado.
- [`requestPasswordReset`](#requestpasswordreset) — Solicita a redefinição de senha para um usuário.
- [`confirmPasswordReset`](#confirmpasswordreset) — Confirma a redefinição de senha de um usuário.
- [`listProjects`](#listprojects) — Lista todos os projetos do usuário.
- [`createProject`](#createproject) — Cria um novo projeto na API.
- [`getProject`](#getproject) — Obtém informações sobre um projeto específico.
- [`updateProject`](#updateproject) — Atualiza um projeto existente na API.
- [`deleteProject`](#deleteproject) — Remove um projeto da API.
- [`listProjectContext`](#listprojectcontext) — Lista o contexto de um projeto específico.
- [`addProjectContext`](#addprojectcontext) — Adiciona um item de contexto a um projeto.
- [`deleteProjectContext`](#deleteprojectcontext) — Remove um item de contexto de um projeto.
- [`createJob`](#createjob) — Cria um novo trabalho na API.
- [`createUploadJob`](#createuploadjob) — Cria um trabalho de upload na API.
- [`listJobs`](#listjobs) — Lista todos os trabalhos do usuário.
- [`getJob`](#getjob) — Obtém informações sobre um trabalho específico.
- [`cancelJob`](#canceljob) — Cancela um trabalho em andamento.
- [`listDocuments`](#listdocuments) — Lista todos os documentos de um trabalho ou projeto.
- [`getDocument`](#getdocument) — Obtém informações sobre um documento específico.
- [`deleteJobRecord`](#deletejobrecord) — Remove o histórico de um trabalho.
- [`exportDocument`](#exportdocument) — Exporta um documento em um formato específico.
- [`getSupportedLanguages`](#getsupportedlanguages) — Obtém a lista de idiomas suportados pela API.
- [`getPlans`](#getplans) — Obtém informações sobre os planos disponíveis na API.
- [`getExportFormats`](#getexportformats) — Obtém os formatos de exportação suportados pela API.
- [`checkHealth`](#checkhealth) — Verifica a saúde da API.
- [`getUsage`](#getusage) — Obtém informações sobre o uso da API.


---

## `LegacyDocApiClient`

*class · linhas 31–327*

> Classe para interagir com a API do Legacy Doc.

```typescript
class LegacyDocApiClient {
```

### Descricao

A classe LegacyDocApiClient fornece métodos para autenticação e operações na API do Legacy Doc. Ela utiliza o vscode.SecretStorage para armazenar e recuperar tokens de autenticação. Os métodos permitem registrar usuários, fazer login, gerenciar projetos e documentos, além de verificar a saúde da API e obter informações sobre planos e idiomas suportados.


---

## `constructor`

*method · em `LegacyDocApiClient` · linhas 32–32 · complexidade ~1*

> Construtor da classe LegacyDocApiClient.

```typescript
constructor(private secrets: vscode.SecretStorage) {}
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `secrets` | `vscode.SecretStorage` | Armazenamento seguro para tokens de autenticação. |

### Descricao

O construtor inicializa uma nova instância da classe LegacyDocApiClient, recebendo um objeto secrets do tipo vscode.SecretStorage. Esse objeto é utilizado para armazenar e recuperar tokens de autenticação necessários para interagir com a API do Legacy Doc.


---

## `setToken`

*method · em `LegacyDocApiClient` · linhas 37–39 · complexidade ~1*

> Armazena um token de autenticação.

```typescript
async setToken(token: string): Promise<void> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `token` | `string` | Token de autenticação a ser armazenado. |

### Retorno

- **Tipo:** `Promise<void>`

### Descricao

O método setToken armazena um token de autenticação no armazenamento seguro. Ele é utilizado após o login ou registro bem-sucedido para garantir que o token esteja disponível para futuras requisições à API. O uso correto deste método é crucial para manter a sessão do usuário ativa.


---

## `getToken`

*method · em `LegacyDocApiClient` · linhas 41–43 · complexidade ~1*

> Recupera o token de autenticação armazenado.

```typescript
async getToken(): Promise<string | undefined> {
```

### Retorno

- **Tipo:** `Promise<string | undefined>`
- Token de autenticação armazenado ou undefined.

### Descricao

O método getToken recupera o token de autenticação armazenado no armazenamento seguro. Ele retorna o token se estiver disponível ou undefined caso contrário. Este método é essencial para verificar se o usuário está autenticado antes de realizar operações que requerem autenticação.


---

## `clearToken`

*method · em `LegacyDocApiClient` · linhas 45–47 · complexidade ~1*

> Remove o token de autenticação armazenado.

```typescript
async clearToken(): Promise<void> {
```

### Retorno

- **Tipo:** `Promise<void>`

### Descricao

O método clearToken remove o token de autenticação do armazenamento seguro. Ele é utilizado para encerrar a sessão do usuário, garantindo que o token não esteja mais disponível para futuras requisições à API. Isso é importante para manter a segurança e a privacidade do usuário.


---

## `request`

*method · em `LegacyDocApiClient` · linhas 52–95 · complexidade ~11*

> Faz uma requisição para a API.

```typescript
private async request<T>(endpoint: string, options: RequestInit = {}, requiresAuth: boolean = true): Promise<T> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `endpoint` | `string` | Endpoint da API a ser chamado. |
| `options` *(opcional)* | `RequestInit` | Opções da requisição, como método e corpo. |
| `requiresAuth` *(opcional)* | `boolean` | Indica se a autenticação é necessária para a requisição. |

### Retorno

- **Tipo:** `Promise<T>`
- Resposta da API do tipo genérico T.

### Descricao

O método request é responsável por realizar chamadas à API do Legacy Doc. Ele aceita um endpoint, opções de requisição e um parâmetro que indica se a autenticação é necessária. O método trata a configuração de cabeçalhos, incluindo o token de autenticação, e lida com a resposta, lançando erros apropriados em caso de falhas. É um método central para a comunicação com a API.


---

## `register`

*method · em `LegacyDocApiClient` · linhas 100–107 · complexidade ~1*

> Registra um novo usuário na API.

```typescript
async register(data: RegisterRequest): Promise<TokenResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `data` | `RegisterRequest` | Dados do usuário para registro. |

### Retorno

- **Tipo:** `Promise<TokenResponse>`
- Resposta da API contendo o token de autenticação.

### Descricao

O método register envia uma requisição para registrar um novo usuário na API do Legacy Doc. Ele recebe os dados do usuário, realiza a chamada à API e armazena o token de autenticação retornado. Isso permite que o usuário comece a usar a API imediatamente após o registro.


---

## `login`

*method · em `LegacyDocApiClient` · linhas 109–116 · complexidade ~1*

> Realiza o login de um usuário na API.

```typescript
async login(data: LoginRequest): Promise<TokenResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `data` | `LoginRequest` | Credenciais do usuário para login. |

### Retorno

- **Tipo:** `Promise<TokenResponse>`
- Resposta da API contendo o token de autenticação.

### Descricao

O método login autentica um usuário na API do Legacy Doc. Ele recebe as credenciais do usuário, faz a chamada à API e armazena o token de autenticação retornado. Isso é essencial para que o usuário possa acessar recursos protegidos da API.


---

## `getMe`

*method · em `LegacyDocApiClient` · linhas 118–120 · complexidade ~1*

> Obtém informações sobre o usuário autenticado.

```typescript
async getMe(): Promise<UserResponse> {
```

### Retorno

- **Tipo:** `Promise<UserResponse>`
- Dados do usuário autenticado.

### Descricao

O método getMe faz uma requisição à API para obter os dados do usuário atualmente autenticado. Ele é útil para verificar a identidade do usuário e acessar suas informações pessoais. Este método requer que o usuário esteja autenticado.


---

## `requestPasswordReset`

*method · em `LegacyDocApiClient` · linhas 122–127 · complexidade ~1*

> Solicita a redefinição de senha para um usuário.

```typescript
async requestPasswordReset(data: PasswordResetRequest): Promise<Record<string, string>> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `data` | `PasswordResetRequest` | Dados necessários para solicitar a redefinição de senha. |

### Retorno

- **Tipo:** `Promise<Record<string, string>>`
- Resposta da API com informações sobre a solicitação de redefinição de senha.

### Descricao

O método requestPasswordReset envia uma requisição à API para iniciar o processo de redefinição de senha. Ele recebe os dados necessários e retorna uma resposta que pode conter informações sobre o status da solicitação. Este método é importante para ajudar usuários que esqueceram suas senhas.


---

## `confirmPasswordReset`

*method · em `LegacyDocApiClient` · linhas 129–136 · complexidade ~1*

> Confirma a redefinição de senha de um usuário.

```typescript
async confirmPasswordReset(data: PasswordResetConfirm): Promise<TokenResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `data` | `PasswordResetConfirm` | Dados necessários para confirmar a redefinição de senha. |

### Retorno

- **Tipo:** `Promise<TokenResponse>`
- Resposta da API contendo o token de autenticação.

### Descricao

O método confirmPasswordReset finaliza o processo de redefinição de senha, enviando os dados necessários para a API. Se bem-sucedido, ele retorna um token de autenticação, permitindo que o usuário faça login com a nova senha. Este método é crucial para garantir a segurança na recuperação de contas.


---

## `listProjects`

*method · em `LegacyDocApiClient` · linhas 141–143 · complexidade ~1*

> Lista todos os projetos do usuário.

```typescript
async listProjects(): Promise<ProjectResponse[]> {
```

### Retorno

- **Tipo:** `Promise<ProjectResponse[]>`
- Lista de projetos do usuário.

### Descricao

O método listProjects faz uma requisição à API para obter uma lista de todos os projetos associados ao usuário autenticado. Ele é útil para que o usuário visualize e gerencie seus projetos. Este método requer que o usuário esteja autenticado.


---

## `createProject`

*method · em `LegacyDocApiClient` · linhas 145–150 · complexidade ~1*

> Cria um novo projeto na API.

```typescript
async createProject(data: ProjectCreateRequest): Promise<ProjectResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `data` | `ProjectCreateRequest` | Dados do projeto a ser criado. |

### Retorno

- **Tipo:** `Promise<ProjectResponse>`
- Informações do projeto criado.

### Descricao

O método createProject envia uma requisição para criar um novo projeto na API do Legacy Doc. Ele recebe os dados do projeto e retorna as informações do projeto criado. Isso permite que o usuário inicie novos projetos rapidamente.


---

## `getProject`

*method · em `LegacyDocApiClient` · linhas 152–154 · complexidade ~1*

> Obtém informações sobre um projeto específico.

```typescript
async getProject(projectId: string): Promise<ProjectResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `projectId` | `string` | ID do projeto a ser obtido. |

### Retorno

- **Tipo:** `Promise<ProjectResponse>`
- Informações do projeto solicitado.

### Descricao

O método getProject faz uma requisição à API para obter detalhes de um projeto específico, identificado pelo seu ID. Isso é útil para que o usuário visualize as informações de um projeto em particular. Este método requer que o usuário esteja autenticado.


---

## `updateProject`

*method · em `LegacyDocApiClient` · linhas 156–161 · complexidade ~1*

> Atualiza um projeto existente na API.

```typescript
async updateProject(projectId: string, data: ProjectUpdateRequest): Promise<ProjectResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `projectId` | `string` | ID do projeto a ser atualizado. |
| `data` | `ProjectUpdateRequest` | Novos dados do projeto. |

### Retorno

- **Tipo:** `Promise<ProjectResponse>`
- Informações do projeto atualizado.

### Descricao

O método updateProject envia uma requisição para atualizar um projeto existente na API do Legacy Doc. Ele recebe o ID do projeto e os novos dados, retornando as informações atualizadas do projeto. Isso permite que o usuário mantenha seus projetos em dia.


---

## `deleteProject`

*method · em `LegacyDocApiClient` · linhas 163–165 · complexidade ~1*

> Remove um projeto da API.

```typescript
async deleteProject(projectId: string): Promise<void> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `projectId` | `string` | ID do projeto a ser removido. |

### Retorno

- **Tipo:** `Promise<void>`

### Descricao

O método deleteProject envia uma requisição para remover um projeto da API do Legacy Doc, identificado pelo seu ID. Isso é útil para que o usuário possa gerenciar seus projetos e remover aqueles que não são mais necessários. Este método requer que o usuário esteja autenticado.


---

## `listProjectContext`

*method · em `LegacyDocApiClient` · linhas 167–169 · complexidade ~1*

> Lista o contexto de um projeto específico.

```typescript
async listProjectContext(projectId: string): Promise<ContextItemResponse[]> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `projectId` | `string` | ID do projeto cujo contexto será listado. |

### Retorno

- **Tipo:** `Promise<ContextItemResponse[]>`
- Lista de itens de contexto do projeto.

### Descricao

O método listProjectContext faz uma requisição à API para obter o contexto de um projeto específico, identificado pelo seu ID. Isso permite que o usuário visualize informações adicionais relacionadas ao projeto. Este método requer que o usuário esteja autenticado.


---

## `addProjectContext`

*method · em `LegacyDocApiClient` · linhas 171–176 · complexidade ~1*

> Adiciona um item de contexto a um projeto.

```typescript
async addProjectContext(projectId: string, data: ContextItemCreateRequest): Promise<ContextItemResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `projectId` | `string` | ID do projeto ao qual o contexto será adicionado. |
| `data` | `ContextItemCreateRequest` | Dados do item de contexto a ser adicionado. |

### Retorno

- **Tipo:** `Promise<ContextItemResponse>`
- Informações do item de contexto adicionado.

### Descricao

O método addProjectContext envia uma requisição para adicionar um item de contexto a um projeto específico na API do Legacy Doc. Ele recebe o ID do projeto e os dados do item de contexto, retornando as informações do item adicionado. Isso é útil para enriquecer os projetos com informações adicionais.


---

## `deleteProjectContext`

*method · em `LegacyDocApiClient` · linhas 178–180 · complexidade ~1*

> Remove um item de contexto de um projeto.

```typescript
async deleteProjectContext(projectId: string, itemId: string): Promise<void> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `projectId` | `string` | ID do projeto do qual o contexto será removido. |
| `itemId` | `string` | ID do item de contexto a ser removido. |

### Retorno

- **Tipo:** `Promise<void>`

### Descricao

O método deleteProjectContext envia uma requisição para remover um item de contexto de um projeto específico na API do Legacy Doc. Ele é identificado pelo ID do projeto e do item de contexto. Isso permite que o usuário gerencie os itens de contexto de seus projetos.


---

## `createJob`

*method · em `LegacyDocApiClient` · linhas 185–190 · complexidade ~1*

> Cria um novo trabalho na API.

```typescript
async createJob(payload: CreateJobPayload): Promise<JobResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `payload` | `CreateJobPayload` | Dados do trabalho a ser criado. |

### Retorno

- **Tipo:** `Promise<JobResponse>`
- Informações do trabalho criado.

### Descricao

O método createJob envia uma requisição para criar um novo trabalho na API do Legacy Doc. Ele recebe os dados do trabalho e retorna as informações do trabalho criado. Isso permite que o usuário inicie novos trabalhos rapidamente.


---

## `createUploadJob`

*method · em `LegacyDocApiClient` · linhas 192–217 · complexidade ~4*

> Cria um trabalho de upload na API.

```typescript
async createUploadJob(zipBuffer: Buffer, fileName: string = 'workspace.zip', options?: { project_id?: string; output_language?: string; depth?: GenerationDepth; }): Promise<JobResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `zipBuffer` | `Buffer` | Buffer contendo o arquivo zip a ser enviado. |
| `fileName` *(opcional)* | `string` | Nome do arquivo zip a ser enviado. |
| `options` *(opcional)* | `{ project_id?: string; output_language?: string; depth?: GenerationDepth; }` | Opções adicionais para o trabalho de upload. |

### Retorno

- **Tipo:** `Promise<JobResponse>`
- Informações do trabalho de upload criado.

### Descricao

O método createUploadJob envia uma requisição para criar um trabalho de upload na API do Legacy Doc. Ele recebe um buffer de arquivo zip, um nome de arquivo e opções adicionais, retornando as informações do trabalho de upload criado. Isso é útil para que o usuário envie arquivos para processamento.


---

## `listJobs`

*method · em `LegacyDocApiClient` · linhas 219–227 · complexidade ~5*

> Lista todos os trabalhos do usuário.

```typescript
async listJobs(params?: { limit?: number; offset?: number; status?: string }): Promise<JobListResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `params` *(opcional)* | `{ limit?: number; offset?: number; status?: string }` | Parâmetros para filtrar e paginar a lista de trabalhos. |

### Retorno

- **Tipo:** `Promise<JobListResponse>`
- Lista de trabalhos do usuário.

### Descricao

O método listJobs faz uma requisição à API para obter uma lista de todos os trabalhos associados ao usuário autenticado. Ele aceita parâmetros opcionais para limitar e paginar os resultados. Isso é útil para que o usuário visualize e gerencie seus trabalhos.


---

## `getJob`

*method · em `LegacyDocApiClient` · linhas 229–231 · complexidade ~1*

> Obtém informações sobre um trabalho específico.

```typescript
async getJob(jobId: string): Promise<JobResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `jobId` | `string` | ID do trabalho a ser obtido. |

### Retorno

- **Tipo:** `Promise<JobResponse>`
- Informações do trabalho solicitado.

### Descricao

O método getJob faz uma requisição à API para obter detalhes de um trabalho específico, identificado pelo seu ID. Isso é útil para que o usuário visualize as informações de um trabalho em particular. Este método requer que o usuário esteja autenticado.


---

## `cancelJob`

*method · em `LegacyDocApiClient` · linhas 233–235 · complexidade ~1*

> Cancela um trabalho em andamento.

```typescript
async cancelJob(jobId: string): Promise<JobResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `jobId` | `string` | ID do trabalho a ser cancelado. |

### Retorno

- **Tipo:** `Promise<JobResponse>`
- Informações do trabalho cancelado.

### Descricao

O método cancelJob envia uma requisição para cancelar um trabalho em andamento na API do Legacy Doc, identificado pelo seu ID. Isso é útil para que o usuário possa interromper trabalhos que não são mais necessários. Este método requer que o usuário esteja autenticado.


---

## `listDocuments`

*method · em `LegacyDocApiClient` · linhas 240–254 · complexidade ~6*

> Lista todos os documentos de um trabalho ou projeto.

```typescript
async listDocuments(params?: { job_id?: string; project_id?: string; limit?: number; offset?: number; }): Promise<DocumentSummaryResponse[]> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `params` *(opcional)* | `{ job_id?: string; project_id?: string; limit?: number; offset?: number; }` | Parâmetros para filtrar e paginar a lista de documentos. |

### Retorno

- **Tipo:** `Promise<DocumentSummaryResponse[]>`
- Lista de documentos do trabalho ou projeto.

### Descricao

O método listDocuments faz uma requisição à API para obter uma lista de documentos associados a um trabalho ou projeto específico. Ele aceita parâmetros opcionais para filtrar e paginar os resultados. Isso é útil para que o usuário visualize e gerencie seus documentos.


---

## `getDocument`

*method · em `LegacyDocApiClient` · linhas 256–258 · complexidade ~1*

> Obtém informações sobre um documento específico.

```typescript
async getDocument(documentId: string): Promise<DocumentResponse> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `documentId` | `string` | ID do documento a ser obtido. |

### Retorno

- **Tipo:** `Promise<DocumentResponse>`
- Informações do documento solicitado.

### Descricao

O método getDocument faz uma requisição à API para obter detalhes de um documento específico, identificado pelo seu ID. Isso é útil para que o usuário visualize as informações de um documento em particular. Este método requer que o usuário esteja autenticado.


---

## `deleteJobRecord`

*method · em `LegacyDocApiClient` · linhas 263–265 · complexidade ~1*

> Remove o histórico de um trabalho.

```typescript
async deleteJobRecord(jobId: string): Promise<void> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `jobId` | `string` | ID do trabalho cujo histórico será removido. |

### Retorno

- **Tipo:** `Promise<void>`

### Descricao

O método deleteJobRecord envia uma requisição para remover o histórico de um trabalho na API do Legacy Doc, identificado pelo seu ID. Isso é útil para que o usuário possa gerenciar os registros de trabalhos que não são mais necessários. Este método requer que o usuário esteja autenticado.


---

## `exportDocument`

*method · em `LegacyDocApiClient` · linhas 271–299 · complexidade ~8*

> Exporta um documento em um formato específico.

```typescript
async exportDocument(documentId: string, format: 'markdown' | 'pdf' | string = 'markdown'): Promise<Buffer> {
```

### Parametros

| Nome | Tipo | Descricao |
| :--- | :--- | :--- |
| `documentId` | `string` | ID do documento a ser exportado. |
| `format` *(opcional)* | `'markdown' | 'pdf' | string` | Formato de exportação do documento. |

### Retorno

- **Tipo:** `Promise<Buffer>`
- Conteúdo do documento exportado em formato Buffer.

### Descricao

O método exportDocument envia uma requisição para exportar um documento na API do Legacy Doc, identificado pelo seu ID. Ele aceita um formato de exportação e retorna o conteúdo do documento exportado. Isso é útil para que o usuário obtenha documentos em formatos desejados, como markdown ou pdf.


---

## `getSupportedLanguages`

*method · em `LegacyDocApiClient` · linhas 304–306 · complexidade ~1*

> Obtém a lista de idiomas suportados pela API.

```typescript
async getSupportedLanguages(): Promise<LanguageResponse[]> {
```

### Retorno

- **Tipo:** `Promise<LanguageResponse[]>`
- Lista de idiomas suportados pela API.

### Descricao

O método getSupportedLanguages faz uma requisição à API para obter a lista de idiomas suportados. Isso é útil para que o usuário saiba quais idiomas estão disponíveis para uso em projetos e documentos. Este método não requer autenticação.


---

## `getPlans`

*method · em `LegacyDocApiClient` · linhas 308–310 · complexidade ~1*

> Obtém informações sobre os planos disponíveis na API.

```typescript
async getPlans(): Promise<PlanInfo[]> {
```

### Retorno

- **Tipo:** `Promise<PlanInfo[]>`
- Lista de planos disponíveis na API.

### Descricao

O método getPlans faz uma requisição à API para obter informações sobre os planos disponíveis. Isso é útil para que o usuário saiba quais opções de assinatura estão disponíveis e quais recursos cada plano oferece. Este método não requer autenticação.


---

## `getExportFormats`

*method · em `LegacyDocApiClient` · linhas 312–314 · complexidade ~1*

> Obtém os formatos de exportação suportados pela API.

```typescript
async getExportFormats(): Promise<string[]> {
```

### Retorno

- **Tipo:** `Promise<string[]>`
- Lista de formatos de exportação suportados pela API.

### Descricao

O método getExportFormats faz uma requisição à API para obter a lista de formatos de exportação suportados. Isso é útil para que o usuário saiba quais formatos estão disponíveis para exportar documentos. Este método não requer autenticação.


---

## `checkHealth`

*method · em `LegacyDocApiClient` · linhas 316–318 · complexidade ~1*

> Verifica a saúde da API.

```typescript
async checkHealth(): Promise<Record<string, string>> {
```

### Retorno

- **Tipo:** `Promise<Record<string, string>>`
- Informações sobre a saúde da API.

### Descricao

O método checkHealth faz uma requisição à API para verificar seu estado de funcionamento. Ele retorna informações sobre a saúde da API, permitindo que o usuário saiba se a API está operacional. Este método não requer autenticação.


---

## `getUsage`

*method · em `LegacyDocApiClient` · linhas 323–325 · complexidade ~1*

> Obtém informações sobre o uso da API.

```typescript
async getUsage(): Promise<UsageResponse> {
```

### Retorno

- **Tipo:** `Promise<UsageResponse>`
- Informações sobre o uso da API.

### Descricao

O método getUsage faz uma requisição à API para obter informações sobre o uso atual da API pelo usuário. Isso é útil para que o usuário monitore seu consumo e verifique se está dentro dos limites permitidos. Este método requer que o usuário esteja autenticado.
