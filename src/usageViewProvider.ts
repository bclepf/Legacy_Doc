import * as vscode from 'vscode';
import { LegacyDocApiClient } from './apiClient';
import { UsageResponse } from './types/api';

export class UsageViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'legacydoc.usageView';
    private view?: vscode.WebviewView;
    private statusBarItem: vscode.StatusBarItem;
    private lastUsage?: UsageResponse;

    constructor(private api: LegacyDocApiClient) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'legacydoc.refreshUsage';
        this.statusBarItem.tooltip = 'Legacy Doc: Clique para atualizar seu saldo de créditos';
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: false
        };

        if (this.lastUsage) {
            this.renderUsage(this.lastUsage);
        } else {
            this.renderLoading();
            this.refresh();
        }
    }

    /**
     * Consulta GET /v1/usage na API e atualiza a barra lateral e a barra de status
     */
    public async refresh(): Promise<UsageResponse | undefined> {
        try {
            const usage = await this.api.getUsage();
            this.lastUsage = usage;
            this.renderUsage(usage);
            this.updateStatusBar(usage);
            return usage;
        } catch (err: any) {
            this.renderError(err.message || 'Não foi possível carregar o consumo.');
            this.statusBarItem.hide();
            return undefined;
        }
    }

    /**
     * Oculta os indicadores ao fazer logout
     */
    public clear(): void {
        this.lastUsage = undefined;
        this.statusBarItem.hide();
        if (this.view) {
            this.view.webview.html = '';
        }
    }

    public dispose(): void {
        this.statusBarItem.dispose();
    }

    private updateStatusBar(usage: UsageResponse): void {
        const icon = usage.exhausted
            ? '$(error)'
            : usage.near_limit
            ? '$(warning)'
            : '$(credit-card)';

        this.statusBarItem.text = `${icon} Legacy Doc: R$ ${usage.credits_remaining_brl.toFixed(2)} (${usage.percent_used.toFixed(0)}% usado)`;
        this.statusBarItem.show();
    }

    private renderLoading(): void {
        if (!this.view) {
            return;
        }
        this.view.webview.html = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <body style="font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 8px 12px;">
                <p style="margin: 0; font-size: 12px; opacity: 0.8;">Carregando saldo de créditos da API...</p>
            </body>
            </html>
        `;
    }

    private renderError(message: string): void {
        if (!this.view) {
            return;
        }
        this.view.webview.html = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <body style="font-family: var(--vscode-font-family); color: var(--vscode-errorForeground); padding: 8px 12px;">
                <p style="margin: 0; font-size: 12px;">Erro ao obter saldo: ${message}</p>
            </body>
            </html>
        `;
    }

    private renderUsage(usage: UsageResponse): void {
        if (!this.view) {
            return;
        }

        const percentClamped = Math.min(100, Math.max(0, usage.percent_used));
        const usedBrl = Math.max(0, usage.credits_total_brl - usage.credits_remaining_brl);
        const renewsDate = new Date(usage.renews_at).toLocaleDateString('pt-BR');

        let barColor = 'var(--vscode-progressBar-background, #0e70c0)';
        let statusBanner = '';

        if (usage.exhausted) {
            barColor = 'var(--vscode-errorForeground, #f14c4c)';
            statusBanner = `
                <div class="alert alert-error">
                    Saldo esgotado! Recarregue seus créditos para gerar novas documentações.
                </div>
            `;
        } else if (usage.near_limit) {
            barColor = 'var(--vscode-editorWarning-foreground, #cca700)';
            statusBanner = `
                <div class="alert alert-warning">
                    Atenção: Seu consumo atingiu ${usage.percent_used.toFixed(0)}% do limite.
                </div>
            `;
        }

        this.view.webview.html = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        padding: 10px 14px;
                        margin: 0;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 6px;
                    }
                    .plan-badge {
                        font-size: 11px;
                        font-weight: 600;
                        padding: 2px 6px;
                        border-radius: 4px;
                        background: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        text-transform: uppercase;
                    }
                    .remaining-highlight {
                        font-size: 13px;
                        font-weight: bold;
                    }
                    .progress-track {
                        width: 100%;
                        height: 8px;
                        background-color: var(--vscode-editorWidget-background, rgba(128, 128, 128, 0.25));
                        border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.2));
                        border-radius: 4px;
                        overflow: hidden;
                        margin: 6px 0;
                    }
                    .progress-fill {
                        height: 100%;
                        width: ${percentClamped}%;
                        background-color: ${barColor};
                        transition: width 0.3s ease;
                    }
                    .meta-row {
                        display: flex;
                        justify-content: space-between;
                        font-size: 11px;
                        opacity: 0.85;
                        margin-top: 4px;
                    }
                    .alert {
                        margin-top: 8px;
                        padding: 6px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        line-height: 1.3;
                    }
                    .alert-warning {
                        background: rgba(204, 167, 0, 0.15);
                        border: 1px solid var(--vscode-editorWarning-foreground, #cca700);
                    }
                    .alert-error {
                        background: rgba(241, 76, 76, 0.15);
                        border: 1px solid var(--vscode-errorForeground, #f14c4c);
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <span class="remaining-highlight">Restante: R$ ${usage.credits_remaining_brl.toFixed(2)}</span>
                    <span class="plan-badge">${usage.plan_name}</span>
                </div>

                <div class="progress-track" title="${usage.percent_used.toFixed(1)}% consumido">
                    <div class="progress-fill"></div>
                </div>

                <div class="meta-row">
                    <span>Usado: R$ ${usedBrl.toFixed(2)} (${usage.percent_used.toFixed(1)}%)</span>
                    <span>Total: R$ ${usage.credits_total_brl.toFixed(2)}</span>
                </div>

                <div class="meta-row">
                    <span>Jobs no mês: ${usage.jobs_used_this_month}/${usage.monthly_job_quota}</span>
                    <span>Renova: ${renewsDate}</span>
                </div>

                ${statusBanner}
            </body>
            </html>
        `;
    }
}