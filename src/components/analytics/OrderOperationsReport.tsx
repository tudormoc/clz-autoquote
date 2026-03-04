'use client'

import { useState } from 'react';
import { Search, Package, CheckCircle, Pause, Play } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getOrderOperationsAction } from '@/app/analytics/queries/order-operations-queries';
import { APP_CONFIG } from '@/config/constants';

interface Operation {
    machine_code: string;
    machine_name: string;
    operation_name: string;
    area_name: string;
    status: 'EXE' | 'SUS' | 'COM' | 'PENDING';
    edition_count: number;
}

interface Edition {
    commessa_display: string;
    commessa_full: string;
    order_description: string;
}

export function OrderOperationsReport() {
    const [searchTerm, setSearchTerm] = useState('');
    const [operations, setOperations] = useState<Operation[]>([]);
    const [editions, setEditions] = useState<Edition[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>('Enter a commessa number or order description');
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!searchTerm.trim()) {
            setMessage('Enter a commessa number or order description');
            setOperations([]);
            setEditions([]);
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);

        const result = await getOrderOperationsAction(searchTerm);

        if (result.success) {
            setOperations(result.data);
            setEditions(result.editions);
            setMessage(result.message);
        } else {
            setError(result.error || 'Failed to load operations');
            setOperations([]);
            setEditions([]);
        }

        setLoading(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'EXE':
                return 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]';
            case 'SUS':
                return 'bg-amber-500/10 border-amber-500/50 text-amber-400';
            case 'COM':
                return 'bg-green-500/10 border-green-500/50 text-green-400';
            default:
                return 'bg-zinc-900/50 border-zinc-800 text-zinc-500';
        }
    };

    const OperationNode = ({ op }: { op: Operation }) => {
        const isCompleted = op.status === 'COM';
        const isInProgress = op.status === 'EXE';
        const isSuspended = op.status === 'SUS';

        return (
            <div className={`
                group relative p-4 rounded-xl border transition-all duration-500
                ${getStatusStyles(op.status)}
                ${isInProgress ? 'ring-1 ring-blue-500/30' : 'hover:border-zinc-700'}
                backdrop-blur-sm
            `}>
                <div className="flex items-center gap-4 relative z-10">
                    <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-700
                        ${isCompleted ? 'bg-green-500/20 text-green-400 border border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.2)]' : ''}
                        ${isInProgress ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-[0_0_25px_rgba(59,130,246,0.3)] animate-pulse' : ''}
                        ${isSuspended ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : ''}
                        ${!isCompleted && !isInProgress && !isSuspended ? 'bg-zinc-800/50 text-zinc-600 border border-zinc-700/50' : ''}
                    `}>
                        {isCompleted && <CheckCircle className="w-5 h-5" />}
                        {isInProgress && <Play className="w-5 h-5 fill-current" />}
                        {isSuspended && <Pause className="w-5 h-5 fill-current" />}
                        {!isCompleted && !isInProgress && !isSuspended && <div className="w-2 h-2 rounded-full bg-zinc-600" />}
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 overflow-hidden">
                            <h4 className={`text-sm font-bold tracking-wide truncate transition-colors duration-300 ${isInProgress ? 'text-blue-100' : isCompleted ? 'text-green-400/90' : 'text-zinc-300 group-hover:text-zinc-100'}`}>
                                {op.operation_name}
                            </h4>
                        </div>
                        <p className="text-[11px] font-medium opacity-60 truncate mt-0.5 uppercase tracking-wider">{op.machine_name}</p>
                    </div>
                </div>

                {isInProgress && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500/60 animate-[shimmer_2s_infinite] w-[40%]" />
                    </div>
                )}
            </div>
        );
    };

    const orderInfo = editions.length > 0 ? editions[0] : null;

    return (
        <div className="space-y-4">
            {/* Search Section */}
            <Card>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Input
                            type="text"
                            placeholder="Search by commessa number (e.g., 8923) or order description..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={loading}
                        />
                    </div>
                    <Button
                        onClick={handleSearch}
                        disabled={loading}
                        className="flex items-center gap-2"
                    >
                        <Search className="w-4 h-4" />
                        {loading ? 'Searching...' : 'Search'}
                    </Button>
                </div>
            </Card>

            {/* Order Header */}
            {orderInfo && (
                <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Package className="w-32 h-32" />
                    </div>

                    <div className="flex items-start gap-6 relative z-10">
                        <div className="flex w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                            <Package className="w-8 h-8 text-primary" />
                        </div>

                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold tracking-tight text-white">
                                    Order <span className="text-primary">{orderInfo.commessa_display}</span>
                                </h2>
                                {editions.length > 1 && (
                                    <div className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                                        {editions.length} Editions
                                    </div>
                                )}
                            </div>

                            <p className="text-zinc-400 mt-1 font-medium max-w-2xl">
                                {orderInfo.order_description}
                            </p>

                            {editions.length > 1 && (
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {editions.map((ed, idx) => (
                                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950/50 border border-zinc-800/50 text-[11px] text-zinc-500">
                                            <span className="font-mono text-zinc-600">{ed.commessa_full}</span>
                                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                            <span className="truncate">{ed.order_description}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Operations Progress Tracker */}
            {operations.length > 0 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    {/* Parallel Phase: 10-40 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                        {/* Connecting Line Decoration */}
                        <div className="absolute top-[4.5rem] bottom-8 left-1/2 w-px bg-gradient-to-b from-transparent via-zinc-800 to-transparent hidden md:block" />

                        {/* Flow A: Internal/Block */}
                        <div className="relative rounded-2xl bg-zinc-900/30 border border-zinc-800/40 p-5 group hover:border-blue-500/20 transition-colors duration-500">
                            <div className="absolute -top-3 left-6 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-full">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                                    Block Production
                                </h3>
                            </div>

                            <div className="space-y-4 pt-4">
                                {operations.filter(op => APP_CONFIG.ANALYTICS.PRODUCTION_FLOW.FLOW_A_AREAS.includes(op.area_name as any)).length > 0 ? (
                                    operations.filter(op => APP_CONFIG.ANALYTICS.PRODUCTION_FLOW.FLOW_A_AREAS.includes(op.area_name as any)).map((op, idx, arr) => (
                                        <div key={idx} className="relative">
                                            {idx < arr.length - 1 && (
                                                <div className="absolute left-[20px] top-[40px] bottom-[-20px] w-[2px] bg-gradient-to-b from-blue-500/20 to-transparent z-0" />
                                            )}
                                            <OperationNode op={op} />
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-6 text-center italic text-zinc-600 text-xs">No block operations scheduled</div>
                                )}
                            </div>
                        </div>

                        {/* Flow B: Cover */}
                        <div className="relative rounded-2xl bg-zinc-900/30 border border-zinc-800/40 p-5 group hover:border-purple-500/20 transition-colors duration-500">
                            <div className="absolute -top-3 left-6 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-full">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                                    Cover Production
                                </h3>
                            </div>

                            <div className="space-y-4 pt-4">
                                {operations.filter(op => APP_CONFIG.ANALYTICS.PRODUCTION_FLOW.FLOW_B_AREAS.includes(op.area_name as any)).length > 0 ? (
                                    operations.filter(op => APP_CONFIG.ANALYTICS.PRODUCTION_FLOW.FLOW_B_AREAS.includes(op.area_name as any)).map((op, idx, arr) => (
                                        <div key={idx} className="relative">
                                            {idx < arr.length - 1 && (
                                                <div className="absolute left-[20px] top-[40px] bottom-[-20px] w-[2px] bg-gradient-to-b from-purple-500/20 to-transparent z-0" />
                                            )}
                                            <OperationNode op={op} />
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-6 text-center italic text-zinc-600 text-xs text-opacity-50">No cover operations scheduled</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Merge Point: Assembly */}
                    <div className="relative p-6 rounded-2xl bg-gradient-to-br from-zinc-900/40 via-zinc-900/20 to-transparent border border-zinc-800/60 shadow-inner">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-zinc-800" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 bg-zinc-950 px-4 py-1.5 border border-zinc-800 rounded-full">
                                Assembly & Binding
                            </h3>
                            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-800" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {operations.filter(op => APP_CONFIG.ANALYTICS.PRODUCTION_FLOW.ASSEMBLY_AREAS.includes(op.area_name as any)).map((op, idx) => (
                                <OperationNode key={idx} op={op} />
                            ))}
                        </div>
                    </div>

                    {/* Finishing */}
                    <div className="relative p-6 rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-950/30">
                        <div className="flex items-center gap-4 mb-6">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">
                                Finishing & Delivery
                            </h3>
                            <div className="h-[1px] flex-1 bg-zinc-900" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {operations.filter(op => APP_CONFIG.ANALYTICS.PRODUCTION_FLOW.FINISHING_AREAS.includes(op.area_name as any)).map((op, idx) => (
                                <OperationNode key={idx} op={op} />
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center justify-center gap-8 py-6 rounded-2xl border border-zinc-800/50 bg-zinc-950/20 mt-12">
                        <div className="flex items-center gap-3 group">
                            <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)] transition-transform group-hover:scale-125" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300">Completed</span>
                        </div>
                        <div className="flex items-center gap-3 group">
                            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.6)] transition-transform group-hover:scale-125" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300">Active</span>
                        </div>
                        <div className="flex items-center gap-3 group">
                            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)] transition-transform group-hover:scale-125" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300">Paused</span>
                        </div>
                        <div className="flex items-center gap-3 group">
                            <div className="w-3 h-3 rounded-full bg-zinc-700 transition-transform group-hover:scale-125" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300">Scheduled</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages */}
            {message && !error && operations.length === 0 && (
                <Card>
                    <div className="text-center py-8 text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm">{message}</p>
                    </div>
                </Card>
            )}

            {/* Error */}
            {error && (
                <Card>
                    <div className="text-center py-8 text-red-600">
                        <p className="text-sm">{error}</p>
                    </div>
                </Card>
            )}
        </div>
    );
}
