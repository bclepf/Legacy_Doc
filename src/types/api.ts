export type GenerationDepth = 'basic' | 'standard' | 'pro';

export type ContextKind = 'glossary' | 'architecture' | 'convention' | 'domain_rule' | 'dependency' | 'freeform';

// --- Auth & User ---
export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    display_name?: string | null;
}

export interface TokenResponse {
    access_token: string;
    token_type: 'bearer';
    expires_in_seconds: number;
}

export interface PasswordResetRequest {
    email: string;
}

export interface PasswordResetConfirm {
    token: string;
    new_password: string;
}

export interface ApiKeyCreateRequest {
    name: string;
}

export interface ApiKeyResponse {
    id: string;
    name: string;
    prefix: string;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
}

export interface ApiKeyCreatedResponse extends ApiKeyResponse {
    api_key: string;
}

export interface PlanInfo {
    tier: string;
    display_name: string;
    monthly_job_quota: number;
    monthly_cost_limit_usd: number;
    max_files_per_job: number;
    max_concurrent_jobs: number;
    features: string[];
    max_depth: string;
    available_depths?: string[];
}

export interface UserResponse {
    id: string;
    email: string;
    display_name: string | null;
    plan: PlanInfo;
    jobs_used_this_month: number;
    spent_this_month_usd: number;
    is_admin?: boolean;
}

// --- Projects & Context ---
export interface ProjectCreateRequest {
    name: string;
    repo_url?: string | null;
    default_branch?: string | null;
    description?: string | null;
}

export interface ProjectUpdateRequest {
    name?: string | null;
    repo_url?: string | null;
    default_branch?: string | null;
    description?: string | null;
}

export interface ProjectResponse {
    id: string;
    name: string;
    slug: string;
    repo_url: string | null;
    default_branch: string | null;
    description: string | null;
    created_at: string;
}

export interface ContextItemCreateRequest {
    kind?: ContextKind;
    title: string;
    content: string;
    path_globs?: string[];
    tags?: string[];
    weight?: number;
}

export interface ContextItemResponse {
    id: string;
    kind: string;
    title: string;
    content: string;
    path_globs: string[];
    tags: string[];
    weight: number;
    created_at: string;
}

// --- Jobs ---
export interface RepositoryJobRequest {
    job_type?: 'document_repository';
    repo_url: string;
    branch?: string | null;
    paths?: string[];
    project_id?: string | null;
    output_language?: string;
    depth?: GenerationDepth | null;
    webhook_url?: string | null;
}

export interface SnippetJobRequest {
    job_type?: 'document_snippet';
    path: string;
    content: string;
    project_id?: string | null;
    output_language?: string;
    depth?: GenerationDepth | null;
    webhook_url?: string | null;
}

export type CreateJobPayload = RepositoryJobRequest | SnippetJobRequest;

export interface JobResponse {
    id: string;
    job_type: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
    progress_percent: number;
    progress_message: string | null;
    attempts: number;
    project_id: string | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    error_code: string | null;
    error_message: string | null;
    document_count?: number;
    depth: string;
    source?: string | null;
}

export interface JobListResponse {
    items: JobResponse[];
    total: number;
}

// --- Documents ---
export interface Parameter {
    name: string;
    type?: string | null;
    description?: string | null;
    optional?: boolean;
    default?: string | null;
}

export interface SymbolDoc {
    name: string;
    kind?: string;
    signature: string;
    language: string;
    line_start?: number;
    line_end?: number;
    summary: string;
    description: string;
    parameters?: Parameter[];
    return_type?: string | null;
    return_description?: string | null;
    raises?: string[];
    side_effects?: string[];
    complexity_estimate?: number | null;
    parent?: string | null;
}

export interface FindingResponse {
    id: string;
    category: string;
    severity: string;
    title: string;
    detail: string;
    suggestion: string | null;
    symbol_name: string | null;
    line_start: number | null;
    line_end: number | null;
    confidence: number;
}

export interface DocumentSummaryResponse {
    id: string;
    job_id: string;
    path: string;
    language: string;
    summary: string | null;
    symbol_count: number;
    finding_count: number;
    depth: string;
    created_at: string;
}

export interface DocumentResponse {
    id: string;
    job_id: string;
    path: string;
    language: string;
    summary: string | null;
    symbols: SymbolDoc[];
    findings: FindingResponse[];
    findings_locked?: boolean;
    depth: string;
    created_at: string;
}

// --- Meta ---
export interface LanguageResponse {
    name: string;
    display_name: string;
    extensions: string[];
}