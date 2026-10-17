import * as vscode from 'vscode';
import {
    ApiKeyCreatedResponse,
    ApiKeyCreateRequest,
    ApiKeyResponse,
    ContextItemCreateRequest,
    ContextItemResponse,
    CreateJobPayload,
    DocumentResponse,
    DocumentSummaryResponse,
    GenerationDepth,
    JobListResponse,
    JobResponse,
    LanguageResponse,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    PlanInfo,
    ProjectCreateRequest,
    ProjectResponse,
    ProjectUpdateRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse
} from './types/api';

const BASE_URL = 'https://api.legacydoc.com.br';
const SECRET_TOKEN_KEY = 'legacydoc.auth.token';

export class LegacyDocApiClient {
    constructor(private secrets: vscode.SecretStorage) {}

    // ==========================================
    // GERENCIAMENTO DE TOKEN LOCAL
    // ==========================================
    async setToken(token: string): Promise<void> {
        await this.secrets.store(SECRET_TOKEN_KEY, token);
    }

    async getToken(): Promise<string | undefined> {
        return await this.secrets.get(SECRET_TOKEN_KEY);
    }

    async clearToken(): Promise<void> {
        await this.secrets.delete(SECRET_TOKEN_KEY);
    }

    // ==========================================
    // HELPER DE REQUISIÇÃO HTTP
    // ==========================================
    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        requiresAuth: boolean = true
    ): Promise<T> {
        const headers = new Headers(options.headers || {});

        if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
        }

        if (requiresAuth) {
            const token = await this.getToken();
            if (!token) {
                throw new Error('Usuário não autenticado no Legacy Doc. Faça login primeiro.');
            }
            headers.set('Authorization', `Bearer ${token}`);
        }

        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 204) {
            return undefined as unknown as T;
        }

        if (!response.ok) {
            let errorDetail = response.statusText;
            try {
                const errJson: any = await response.json();
                errorDetail = errJson.detail
                    ? JSON.stringify(errJson.detail)
                    : JSON.stringify(errJson);
            } catch {
                errorDetail = await response.text();
            }
            throw new Error(`Erro na API (${response.status}): ${errorDetail}`);
        }

        return (await response.json()) as T;
    }

    // ==========================================
    // 1. AUTENTICAÇÃO E USUÁRIO (/v1/auth/*)
    // ==========================================
    async register(data: RegisterRequest): Promise<TokenResponse> {
        const res = await this.request<TokenResponse>('/v1/auth/register', {
            method: 'POST',
            body: JSON.stringify(data)
        }, false);
        await this.setToken(res.access_token);
        return res;
    }

    async login(data: LoginRequest): Promise<TokenResponse> {
        const res = await this.request<TokenResponse>('/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify(data)
        }, false);
        await this.setToken(res.access_token);
        return res;
    }

    async getMe(): Promise<UserResponse> {
        return await this.request<UserResponse>('/v1/auth/me', { method: 'GET' });
    }

    async requestPasswordReset(data: PasswordResetRequest): Promise<Record<string, string>> {
        return await this.request<Record<string, string>>('/v1/auth/password-reset/request', {
            method: 'POST',
            body: JSON.stringify(data)
        }, false);
    }

    async confirmPasswordReset(data: PasswordResetConfirm): Promise<TokenResponse> {
        const res = await this.request<TokenResponse>('/v1/auth/password-reset/confirm', {
            method: 'POST',
            body: JSON.stringify(data)
        }, false);
        await this.setToken(res.access_token);
        return res;
    }

    async listApiKeys(): Promise<ApiKeyResponse[]> {
        return await this.request<ApiKeyResponse[]>('/v1/auth/api-keys', { method: 'GET' });
    }

    async createApiKey(data: ApiKeyCreateRequest): Promise<ApiKeyCreatedResponse> {
        return await this.request<ApiKeyCreatedResponse>('/v1/auth/api-keys', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async revokeApiKey(keyId: string): Promise<void> {
        await this.request<void>(`/v1/auth/api-keys/${keyId}`, { method: 'DELETE' });
    }

    // ==========================================
    // 2. PROJETOS E CONTEXTO (/v1/projects/*)
    // ==========================================
    async listProjects(): Promise<ProjectResponse[]> {
        return await this.request<ProjectResponse[]>('/v1/projects', { method: 'GET' });
    }

    async createProject(data: ProjectCreateRequest): Promise<ProjectResponse> {
        return await this.request<ProjectResponse>('/v1/projects', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getProject(projectId: string): Promise<ProjectResponse> {
        return await this.request<ProjectResponse>(`/v1/projects/${projectId}`, { method: 'GET' });
    }

    async updateProject(projectId: string, data: ProjectUpdateRequest): Promise<ProjectResponse> {
        return await this.request<ProjectResponse>(`/v1/projects/${projectId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    async deleteProject(projectId: string): Promise<void> {
        await this.request<void>(`/v1/projects/${projectId}`, { method: 'DELETE' });
    }

    async listProjectContext(projectId: string): Promise<ContextItemResponse[]> {
        return await this.request<ContextItemResponse[]>(`/v1/projects/${projectId}/context`, { method: 'GET' });
    }

    async addProjectContext(projectId: string, data: ContextItemCreateRequest): Promise<ContextItemResponse> {
        return await this.request<ContextItemResponse>(`/v1/projects/${projectId}/context`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async deleteProjectContext(projectId: string, itemId: string): Promise<void> {
        await this.request<void>(`/v1/projects/${projectId}/context/${itemId}`, { method: 'DELETE' });
    }

    // ==========================================
    // 3. JOBS DE DOCUMENTAÇÃO (/v1/jobs/*)
    // ==========================================
    async createJob(payload: CreateJobPayload): Promise<JobResponse> {
        return await this.request<JobResponse>('/v1/jobs', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async createUploadJob(
        zipBuffer: Buffer,
        fileName: string = 'workspace.zip',
        options?: {
            project_id?: string;
            output_language?: string;
            depth?: GenerationDepth;
        }
    ): Promise<JobResponse> {
        const formData = new FormData();
        const blob = new Blob([zipBuffer], { type: 'application/zip' });
        formData.append('file', blob, fileName);

        if (options?.project_id) {
            formData.append('project_id', options.project_id);
        }
        formData.append('output_language', options?.output_language || 'pt-BR');
        if (options?.depth) {
            formData.append('depth', options.depth);
        }

        return await this.request<JobResponse>('/v1/jobs/upload', {
            method: 'POST',
            body: formData
        });
    }

    async listJobs(params?: { limit?: number; offset?: number; status?: string }): Promise<JobListResponse> {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));
        if (params?.status) query.set('status', params.status);

        const qs = query.toString() ? `?${query.toString()}` : '';
        return await this.request<JobListResponse>(`/v1/jobs${qs}`, { method: 'GET' });
    }

    async getJob(jobId: string): Promise<JobResponse> {
        return await this.request<JobResponse>(`/v1/jobs/${jobId}`, { method: 'GET' });
    }

    async cancelJob(jobId: string): Promise<JobResponse> {
        return await this.request<JobResponse>(`/v1/jobs/${jobId}`, { method: 'DELETE' });
    }

    // ==========================================
    // 4. DOCUMENTOS E EXPORTAÇÃO (/v1/documents/*)
    // ==========================================
    async listDocuments(params?: {
        job_id?: string;
        project_id?: string;
        limit?: number;
        offset?: number;
    }): Promise<DocumentSummaryResponse[]> {
        const query = new URLSearchParams();
        if (params?.job_id) query.set('job_id', params.job_id);
        if (params?.project_id) query.set('project_id', params.project_id);
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));

        const qs = query.toString() ? `?${query.toString()}` : '';
        return await this.request<DocumentSummaryResponse[]>(`/v1/documents${qs}`, { method: 'GET' });
    }

    async getDocument(documentId: string): Promise<DocumentResponse> {
        return await this.request<DocumentResponse>(`/v1/documents/${documentId}`, { method: 'GET' });
    }

    /**
     * Exporta o documento no formato solicitado (ex: 'markdown' ou 'pdf').
     * Retorna um Buffer pronto para ser salvo no disco com fs.writeFileSync.
     */
    async exportDocument(documentId: string, format: 'markdown' | 'pdf' | string = 'markdown'): Promise<Buffer> {
        const token = await this.getToken();
        if (!token) {
            throw new Error('Usuário não autenticado.');
        }

        const response = await fetch(`${BASE_URL}/v1/documents/${documentId}/export?format=${encodeURIComponent(format)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Falha ao exportar documento (${response.status}): ${await response.text()}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data: any = await response.json();
            const textContent = typeof data === 'string' ? data : (data.content || data.markdown || JSON.stringify(data, null, 2));
            return Buffer.from(textContent, 'utf-8');
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }

    async deleteDocument(documentId: string): Promise<void> {
        await this.request<void>(`/v1/documents/${documentId}`, { method: 'DELETE' });
    }

    // ==========================================
    // 5. METADADOS E HEALTH (/v1/meta/* & /health)
    // ==========================================
    async getSupportedLanguages(): Promise<LanguageResponse[]> {
        return await this.request<LanguageResponse[]>('/v1/meta/languages', { method: 'GET' }, false);
    }

    async getPlans(): Promise<PlanInfo[]> {
        return await this.request<PlanInfo[]>('/v1/meta/plans', { method: 'GET' }, false);
    }

    async getExportFormats(): Promise<string[]> {
        return await this.request<string[]>('/v1/meta/export-formats', { method: 'GET' }, false);
    }

    async checkHealth(): Promise<Record<string, string>> {
        return await this.request<Record<string, string>>('/health', { method: 'GET' }, false);
    }
}