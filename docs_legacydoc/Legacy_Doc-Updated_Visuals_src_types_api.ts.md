# `Legacy_Doc-Updated_Visuals/src/types/api.ts`

> Linguagem: **typescript** · Simbolos documentados: **28**


O arquivo 'api.ts' contém diversas interfaces que definem a estrutura das requisições e respostas para operações relacionadas à autenticação, gerenciamento de usuários, projetos e pacotes de uso. Essas interfaces são fundamentais para a comunicação entre o cliente e o servidor, garantindo que os dados sejam transmitidos de forma consistente e organizada. Além disso, o arquivo também abrange funcionalidades para criação e gerenciamento de chaves de API, bem como para a documentação de símbolos e respostas de achados.


## Indice

- [`LoginRequest`](#loginrequest) — Interface para requisições de login.
- [`RegisterRequest`](#registerrequest) — Interface para requisições de registro.
- [`TokenResponse`](#tokenresponse) — Interface para resposta de token.
- [`PasswordResetRequest`](#passwordresetrequest) — Interface para requisições de redefinição de senha.
- [`PasswordResetConfirm`](#passwordresetconfirm) — Interface para confirmação de redefinição de senha.
- [`ApiKeyCreateRequest`](#apikeycreaterequest) — Interface para requisições de criação de chave de API.
- [`ApiKeyResponse`](#apikeyresponse) — Interface para resposta de chave de API.
- [`ApiKeyCreatedResponse`](#apikeycreatedresponse) — Interface para resposta de chave de API criada.
- [`PlanInfo`](#planinfo) — Interface para informações de plano.
- [`UsagePack`](#usagepack) — Interface para pacotes de uso.
- [`UsageTopup`](#usagetopup) — Interface para recargas de uso.
- [`UsageResponse`](#usageresponse) — Interface para resposta de uso.
- [`UserResponse`](#userresponse) — Interface para resposta de usuário.
- [`ProjectCreateRequest`](#projectcreaterequest) — Interface para requisições de criação de projeto.
- [`ProjectUpdateRequest`](#projectupdaterequest) — Interface para requisições de atualização de projeto.
- [`ProjectResponse`](#projectresponse) — Interface para resposta de projeto.
- [`ContextItemCreateRequest`](#contextitemcreaterequest) — Interface para requisições de criação de item de contexto.
- [`ContextItemResponse`](#contextitemresponse) — Interface para resposta de item de contexto.
- [`RepositoryJobRequest`](#repositoryjobrequest) — Interface para requisições de trabalho em repositório.
- [`SnippetJobRequest`](#snippetjobrequest) — Interface para requisições de trabalho em snippet.
- [`JobResponse`](#jobresponse) — Interface para resposta de trabalho.
- [`JobListResponse`](#joblistresponse) — Interface para resposta de lista de trabalhos.
- [`Parameter`](#parameter) — Interface para parâmetros.
- [`SymbolDoc`](#symboldoc) — Interface para documentação de símbolos.
- [`FindingResponse`](#findingresponse) — Interface para resposta de achados.
- [`DocumentSummaryResponse`](#documentsummaryresponse) — Interface para resposta de resumo de documento.
- [`DocumentResponse`](#documentresponse) — Interface para resposta de documento.
- [`LanguageResponse`](#languageresponse) — Interface para resposta de linguagem.


---

## `LoginRequest`

*interface · linhas 6–9*

> Interface para requisições de login.

```typescript
interface LoginRequest {
```

### Descricao

A interface LoginRequest define a estrutura dos dados necessários para realizar uma requisição de login. Ela é utilizada para garantir que as informações enviadas estejam no formato correto, facilitando a autenticação do usuário no sistema.


---

## `RegisterRequest`

*interface · linhas 11–15*

> Interface para requisições de registro.

```typescript
interface RegisterRequest {
```

### Descricao

A interface RegisterRequest especifica os dados necessários para o registro de um novo usuário. Isso assegura que todas as informações requeridas sejam coletadas e enviadas corretamente para o sistema, permitindo a criação de uma nova conta.


---

## `TokenResponse`

*interface · linhas 17–21*

> Interface para resposta de token.

```typescript
interface TokenResponse {
```

### Descricao

A interface TokenResponse define a estrutura da resposta que contém o token de autenticação após um login bem-sucedido. Essa estrutura é crucial para a comunicação segura entre o cliente e o servidor, permitindo o acesso a recursos protegidos.


---

## `PasswordResetRequest`

*interface · linhas 23–25*

> Interface para requisições de redefinição de senha.

```typescript
interface PasswordResetRequest {
```

### Descricao

A interface PasswordResetRequest descreve os dados necessários para solicitar a redefinição de senha de um usuário. Isso assegura que as informações necessárias sejam coletadas de forma adequada, facilitando o processo de recuperação de conta.


---

## `PasswordResetConfirm`

*interface · linhas 27–30*

> Interface para confirmação de redefinição de senha.

```typescript
interface PasswordResetConfirm {
```

### Descricao

A interface PasswordResetConfirm define a estrutura dos dados necessários para confirmar a redefinição de senha. Ela é utilizada para garantir que o usuário forneça as informações corretas para completar o processo de alteração de senha.


---

## `ApiKeyCreateRequest`

*interface · linhas 32–34*

> Interface para requisições de criação de chave de API.

```typescript
interface ApiKeyCreateRequest {
```

### Descricao

A interface ApiKeyCreateRequest especifica os dados necessários para criar uma nova chave de API. Isso ajuda a garantir que as informações enviadas estejam corretas, permitindo que os desenvolvedores integrem suas aplicações de forma segura.


---

## `ApiKeyResponse`

*interface · linhas 36–43*

> Interface para resposta de chave de API.

```typescript
interface ApiKeyResponse {
```

### Descricao

A interface ApiKeyResponse define a estrutura da resposta que contém os detalhes da chave de API criada. Essa resposta é essencial para que os desenvolvedores possam utilizar a chave gerada em suas aplicações.


---

## `ApiKeyCreatedResponse`

*interface · linhas 45–47*

> Interface para resposta de chave de API criada.

```typescript
interface ApiKeyCreatedResponse extends ApiKeyResponse {
```

### Descricao

A interface ApiKeyCreatedResponse estende ApiKeyResponse e adiciona informações adicionais sobre a chave de API recém-criada. Isso permite que os desenvolvedores tenham acesso a dados extras que podem ser relevantes após a criação da chave.


---

## `PlanInfo`

*interface · linhas 49–60*

> Interface para informações de plano.

```typescript
interface PlanInfo {
```

### Descricao

A interface PlanInfo define a estrutura dos dados que descrevem um plano de assinatura ou serviço. Essa informação é importante para que os usuários entendam as características e limitações de seus planos.


---

## `UsagePack`

*interface · linhas 63–66*

> Interface para pacotes de uso.

```typescript
interface UsagePack {
```

### Descricao

A interface UsagePack especifica a estrutura dos dados relacionados ao uso de recursos em um determinado plano. Isso ajuda a monitorar e gerenciar o consumo de recursos pelos usuários.


---

## `UsageTopup`

*interface · linhas 68–72*

> Interface para recargas de uso.

```typescript
interface UsageTopup {
```

### Descricao

A interface UsageTopup define a estrutura dos dados necessários para realizar uma recarga de uso em um plano. Isso permite que os usuários aumentem seus limites de uso conforme necessário, garantindo a continuidade do serviço.


---

## `UsageResponse`

*interface · linhas 74–90*

> Interface para resposta de uso.

```typescript
interface UsageResponse {
```

### Descricao

A interface UsageResponse define a estrutura da resposta que contém informações sobre o uso de recursos por um usuário. Isso é essencial para que os usuários possam acompanhar seu consumo e planejar recargas ou upgrades.


---

## `UserResponse`

*interface · linhas 92–100*

> Interface para resposta de usuário.

```typescript
interface UserResponse {
```

### Descricao

A interface UserResponse define a estrutura da resposta que contém informações sobre um usuário. Isso é importante para que as aplicações possam exibir dados relevantes sobre o usuário autenticado ou registrado.


---

## `ProjectCreateRequest`

*interface · linhas 103–108*

> Interface para requisições de criação de projeto.

```typescript
interface ProjectCreateRequest {
```

### Descricao

A interface ProjectCreateRequest especifica os dados necessários para criar um novo projeto. Isso garante que todas as informações relevantes sejam coletadas, facilitando a gestão de projetos dentro do sistema.


---

## `ProjectUpdateRequest`

*interface · linhas 110–115*

> Interface para requisições de atualização de projeto.

```typescript
interface ProjectUpdateRequest {
```

### Descricao

A interface ProjectUpdateRequest define a estrutura dos dados necessários para atualizar um projeto existente. Isso assegura que as modificações sejam feitas de forma correta e eficiente, mantendo a integridade dos dados do projeto.


---

## `ProjectResponse`

*interface · linhas 117–125*

> Interface para resposta de projeto.

```typescript
interface ProjectResponse {
```

### Descricao

A interface ProjectResponse define a estrutura da resposta que contém informações sobre um projeto. Isso é essencial para que os usuários possam visualizar os detalhes dos projetos que estão gerenciando ou participando.


---

## `ContextItemCreateRequest`

*interface · linhas 127–134*

> Interface para requisições de criação de item de contexto.

```typescript
interface ContextItemCreateRequest {
```

### Descricao

A interface ContextItemCreateRequest especifica os dados necessários para criar um novo item de contexto. Isso ajuda a organizar informações relevantes dentro do sistema, facilitando a gestão de dados contextuais.


---

## `ContextItemResponse`

*interface · linhas 136–145*

> Interface para resposta de item de contexto.

```typescript
interface ContextItemResponse {
```

### Descricao

A interface ContextItemResponse define a estrutura da resposta que contém informações sobre um item de contexto. Isso é importante para que os usuários possam acessar e visualizar dados contextuais relevantes em suas aplicações.


---

## `RepositoryJobRequest`

*interface · linhas 148–157*

> Interface para requisições de trabalho em repositório.

```typescript
interface RepositoryJobRequest {
```

### Descricao

A interface RepositoryJobRequest define a estrutura dos dados necessários para solicitar um trabalho relacionado a um repositório. Isso é essencial para gerenciar operações em repositórios de forma organizada e eficiente.


---

## `SnippetJobRequest`

*interface · linhas 159–167*

> Interface para requisições de trabalho em snippet.

```typescript
interface SnippetJobRequest {
```

### Descricao

A interface SnippetJobRequest especifica os dados necessários para solicitar um trabalho relacionado a um snippet de código. Isso ajuda a organizar e gerenciar tarefas de forma eficaz dentro do sistema.


---

## `JobResponse`

*interface · linhas 171–187*

> Interface para resposta de trabalho.

```typescript
interface JobResponse {
```

### Descricao

A interface JobResponse define a estrutura da resposta que contém informações sobre um trabalho solicitado. Isso é importante para que os usuários possam acompanhar o status e os resultados de suas requisições de trabalho.


---

## `JobListResponse`

*interface · linhas 189–192*

> Interface para resposta de lista de trabalhos.

```typescript
interface JobListResponse {
```

### Descricao

A interface JobListResponse define a estrutura da resposta que contém uma lista de trabalhos. Isso permite que os usuários visualizem e gerenciem múltiplas requisições de trabalho de forma eficiente.


---

## `Parameter`

*interface · linhas 195–201*

> Interface para parâmetros.

```typescript
interface Parameter {
```

### Descricao

A interface Parameter define a estrutura dos parâmetros utilizados em requisições ou respostas. Isso é fundamental para garantir que os dados sejam passados de forma consistente e compreensível entre diferentes partes do sistema.


---

## `SymbolDoc`

*interface · linhas 203–219*

> Interface para documentação de símbolos.

```typescript
interface SymbolDoc {
```

### Descricao

A interface SymbolDoc define a estrutura da documentação para símbolos como funções, classes e interfaces. Isso é importante para facilitar a compreensão e o uso correto dos componentes do sistema por desenvolvedores.


---

## `FindingResponse`

*interface · linhas 221–232*

> Interface para resposta de achados.

```typescript
interface FindingResponse {
```

### Descricao

A interface FindingResponse define a estrutura da resposta que contém informações sobre achados ou resultados de análises. Isso é essencial para que os usuários possam entender os resultados de suas requisições de busca ou análise.


---

## `DocumentSummaryResponse`

*interface · linhas 234–244*

> Interface para resposta de resumo de documento.

```typescript
interface DocumentSummaryResponse {
```

### Descricao

A interface DocumentSummaryResponse define a estrutura da resposta que contém um resumo de um documento. Isso permite que os usuários visualizem informações relevantes de forma rápida e eficiente.


---

## `DocumentResponse`

*interface · linhas 246–257*

> Interface para resposta de documento.

```typescript
interface DocumentResponse {
```

### Descricao

A interface DocumentResponse define a estrutura da resposta que contém informações detalhadas sobre um documento. Isso é importante para que os usuários possam acessar e entender o conteúdo completo de um documento específico.


---

## `LanguageResponse`

*interface · linhas 260–264*

> Interface para resposta de linguagem.

```typescript
interface LanguageResponse {
```

### Descricao

A interface LanguageResponse define a estrutura da resposta que contém informações sobre uma linguagem específica. Isso é útil para que os usuários possam acessar dados relevantes sobre linguagens de programação ou de marcação.
