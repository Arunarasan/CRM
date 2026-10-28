import { useState } from 'react';
import { Copy, FileText, Loader2, MessageCircle, Share2 } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/components/ui/toast';
import { quoteLink } from '@/pages/leads/quote/ShareQuoteDialog';

interface LinkInfo {
  shareToken: string; quotationNumber?: string; customerName?: string; customerPhone?: string; staffName?: string;
}

/** Project task: send the customer their quotation link (/q/{token}) by WhatsApp, the share sheet or copy. */
export default function ShareQuotationCard({ taskId }: { taskId: number }) {
  const [busy, setBusy] = useState(false);

  const run = async (how: 'wa' | 'share' | 'copy') => {
    setBusy(true);
    try {
      const info = (await api.post<LinkInfo>(`/employee-portal/tasks/${taskId}/quotation-link`)).data;
      const link = quoteLink(info.shareToken);
      const text = [
        info.customerName ? `Dear ${info.customerName},` : 'Dear Customer,',
        '',
        `Please view your quotation${info.quotationNumber ? ` ${info.quotationNumber}` : ''} here:`,
        link,
        ...(info.staffName ? ['', `Regards,`, info.staffName] : []),
      ].join('\n');
      if (how === 'copy') {
        await navigator.clipboard.writeText(link);
        toast.success('Quotation link copied');
      } else if (how === 'share' && navigator.share) {
        await navigator.share({ title: 'Quotation', text });
      } else {
        const d = (info.customerPhone || '').replace(/\D/g, '').replace(/^0+/, '');
        const num = d.length === 10 ? `91${d}` : d;
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') toast.error(e?.response?.data?.message || 'Could not get the quotation link');
    } finally {
      setBusy(false);
    }
  };

  const btn = 'flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#D7DED8] bg-white py-2.5 text-[13px] font-semibold text-[#0A573B] active:scale-[0.99] disabled:opacity-60';
  return (
    <div className="rounded-2xl border border-[#EDE6D8] bg-white p-4 shadow-[0_2px_10px_rgba(80,55,20,0.05)]">
      <div className="mb-2.5 flex items-center gap-2 text-[14px] font-semibold text-[#1A211E]">
        <FileText className="h-4 w-4" /> Share quotation
        {busy && <Loader2 className="ml-auto h-4 w-4 animate-spin text-[#7A817C]" />}
      </div>
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => run('wa')} className={btn}><MessageCircle className="h-4 w-4" /> WhatsApp</button>
        <button disabled={busy} onClick={() => run('share')} className={btn}><Share2 className="h-4 w-4" /> Share</button>
        <button disabled={busy} onClick={() => run('copy')} className={btn}><Copy className="h-4 w-4" /> Copy</button>
      </div>
    </div>
  );
}
