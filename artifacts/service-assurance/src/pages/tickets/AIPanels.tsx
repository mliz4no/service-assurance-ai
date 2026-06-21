import { ClipboardCopy, RefreshCw, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { timeAgo } from './ticket-utils';
import type { TicketWithAI } from '@/types';
import type {
  useAiSummarizeTicket,
  useAiNormalizeLatestUpdate,
  useAiGenerateCustomerUpdate,
} from '@workspace/api-client-react';

type SummarizeMutation = ReturnType<typeof useAiSummarizeTicket>;
type NormalizeMutation = ReturnType<typeof useAiNormalizeLatestUpdate>;
type CustomerUpdateMutation = ReturnType<typeof useAiGenerateCustomerUpdate>;

interface Props {
  ticket: TicketWithAI;
  summarizeMutation: SummarizeMutation;
  normalizeMutation: NormalizeMutation;
  customerUpdateMutation: CustomerUpdateMutation;
  onRunAi: (action: 'summarize' | 'normalize' | 'customer_update') => void;
  onCopyToClipboard: (text: string) => void;
  onUseAsUpdate: (text: string) => void;
}

export function AIPanels({
  ticket,
  summarizeMutation,
  normalizeMutation,
  customerUpdateMutation,
  onRunAi,
  onCopyToClipboard,
  onUseAsUpdate,
}: Props) {
  return (
    <Card className="border-indigo-200 bg-indigo-50/40 shadow-sm mb-5">
      <CardHeader className="pb-0 pt-4 px-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <CardTitle className="text-sm font-semibold text-indigo-900">AI Insights</CardTitle>
          {ticket.aiConfidence != null && (
            <span
              className={cn(
                'text-xs font-bold px-1.5 py-0.5 rounded',
                ticket.aiConfidence >= 80
                  ? 'bg-green-100 text-green-800'
                  : ticket.aiConfidence >= 50
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800',
              )}
            >
              {ticket.aiConfidence}% confidence
            </span>
          )}
          {ticket.aiLastGeneratedAt && (
            <span className="text-xs text-indigo-500 ml-auto">
              Last run {timeAgo(ticket.aiLastGeneratedAt)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pt-3 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Executive Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                  Executive Summary
                </p>
                {ticket.aiSummarizedAt && (
                  <p className="text-[10px] text-indigo-400 mt-0.5">
                    Generated {timeAgo(ticket.aiSummarizedAt)}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-100"
                onClick={() => onRunAi('summarize')}
                disabled={summarizeMutation.isPending}
              >
                {summarizeMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Generating
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Regenerate
                  </>
                )}
              </Button>
            </div>
            {ticket.aiSummary ? (
              <p className="text-sm text-slate-700 bg-white rounded-md border border-indigo-100 p-3 leading-relaxed">
                {ticket.aiSummary}
              </p>
            ) : (
              <button
                onClick={() => onRunAi('summarize')}
                className="w-full text-sm text-indigo-500 italic bg-white rounded-md border border-dashed border-indigo-200 p-3 text-left hover:bg-indigo-50 transition-colors"
              >
                Click to generate summary...
              </button>
            )}
          </div>

          {/* Normalized Vendor Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                  Normalized Status
                </p>
                {ticket.aiNormalizedAt && (
                  <p className="text-[10px] text-indigo-400 mt-0.5">
                    Generated {timeAgo(ticket.aiNormalizedAt)}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-100"
                onClick={() => onRunAi('normalize')}
                disabled={normalizeMutation.isPending}
              >
                {normalizeMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    Generating
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Regenerate
                  </>
                )}
              </Button>
            </div>
            {ticket.aiNormalizedStatus ? (
              <div className="bg-white rounded-md border border-indigo-100 p-3">
                <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 font-medium">
                  {ticket.aiNormalizedStatus}
                </Badge>
              </div>
            ) : (
              <button
                onClick={() => onRunAi('normalize')}
                className="w-full text-sm text-indigo-500 italic bg-white rounded-md border border-dashed border-indigo-200 p-3 text-left hover:bg-indigo-50 transition-colors"
              >
                Click to normalize latest vendor update...
              </button>
            )}
          </div>

          {/* Customer Update Draft */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                  Customer Update Draft
                </p>
                {ticket.aiCustomerUpdateAt && (
                  <p className="text-[10px] text-indigo-400 mt-0.5">
                    Generated {timeAgo(ticket.aiCustomerUpdateAt)}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                {ticket.aiCustomerUpdate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-100"
                    onClick={() => onCopyToClipboard(ticket.aiCustomerUpdate!)}
                  >
                    <ClipboardCopy className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-100"
                  onClick={() => onRunAi('customer_update')}
                  disabled={customerUpdateMutation.isPending}
                >
                  {customerUpdateMutation.isPending ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      Generating
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Regenerate
                    </>
                  )}
                </Button>
              </div>
            </div>
            {ticket.aiCustomerUpdate ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-700 bg-white rounded-md border border-indigo-100 p-3 leading-relaxed">
                  {ticket.aiCustomerUpdate}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs h-7 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => onUseAsUpdate(ticket.aiCustomerUpdate!)}
                >
                  Use as Update
                </Button>
              </div>
            ) : (
              <button
                onClick={() => onRunAi('customer_update')}
                className="w-full text-sm text-indigo-500 italic bg-white rounded-md border border-dashed border-indigo-200 p-3 text-left hover:bg-indigo-50 transition-colors"
              >
                Click to draft customer-facing update...
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
