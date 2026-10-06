'use client';

import { Card } from '@/components/ui/Card';
import { DollarSign, FileCode } from 'lucide-react';
import { APP_CONFIG } from '@/config/constants';

export function SettingsManager() {
    const hourlyRate = APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE;

    return (
        <div className="space-y-6">
            <Card className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <DollarSign className="text-primary" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-fg-strong">Analytics Settings</h2>
                        <p className="text-sm text-fg-muted">Labor cost calculation configuration</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-card/50 p-6 rounded-lg border border-border">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-medium text-fg-secondary mb-1">Hourly Labor Rate</h3>
                                <p className="text-xs text-fg-subtle">
                                    Used to calculate work costs in analytics reports
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-bold text-primary font-mono">€{hourlyRate.toFixed(2)}</p>
                                <p className="text-xs text-fg-subtle mt-1">per hour</p>
                            </div>
                        </div>
                        
                        <div className="pt-4 border-t border-border">
                            <p className="text-xs text-fg-muted mb-2">Example calculation:</p>
                            <div className="bg-background p-3 rounded font-mono text-xs text-fg-secondary">
                                10 hours × €{hourlyRate.toFixed(2)}/hour = €{(hourlyRate * 10).toFixed(2)}
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                            <FileCode className="text-primary mt-0.5" size={18} />
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-fg-strong mb-2">How to Edit</h3>
                                <p className="text-xs text-fg-muted mb-3">
                                    To change the hourly rate, edit the value in the constants file:
                                </p>
                                <div className="bg-background p-3 rounded border border-border">
                                    <code className="text-xs text-primary">
                                        src/config/constants.ts
                                    </code>
                                    <div className="mt-2 text-xs text-fg-muted">
                                        Look for: <code className="text-fg-secondary">APP_CONFIG.ANALYTICS.HOURLY_LABOR_RATE</code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
