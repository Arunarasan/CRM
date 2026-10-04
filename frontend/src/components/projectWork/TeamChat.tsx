import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Tag, X } from 'lucide-react';
import api from '@/lib/api';
import AudioCaptureField, { CapturedAudio } from '@/components/AudioCaptureField';
import { resolveFileUrl } from '@/lib/uploadFile';
import { toast } from '@/components/ui/toast';
import { CommentSummary } from '@/types/employeeTask';
import { INPUT, PhotoPicker, errMsg, fmtWhen } from './workUi';

export interface ChatTag { workLineId?: number | null; label: string }

const VOICE = '🎤 Voice note';
const PHOTO = '📷 Photo';

/**
 * Team chat on a project task — text, camera / gallery photos and mic voice notes, optionally tagged
 * to a product or installation category. Messages are the task's comments, so they also show on the
 * task report.
 */
export default function TeamChat({ taskId, comments, onPosted, locked, tag, onClearTag, tagOptions, myId }: {
  taskId: number;
  comments: CommentSummary[];
  onPosted: () => void;
  locked?: boolean;
  tag?: ChatTag | null;
  onClearTag?: () => void;
  tagOptions?: ChatTag[];
  myId?: number | null;
}) {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState<CapturedAudio[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const [localTag, setLocalTag] = useState<ChatTag | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const activeTag = tag ?? localTag;

  // Oldest first, like a chat.
  const ordered = useMemo(() => [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [comments]);
  const shown = filter ? ordered.filter((c) => c.tagLabel === filter) : ordered;
  const labels = useMemo(() => Array.from(new Set(comments.map((c) => c.tagLabel).filter(Boolean))) as string[], [comments]);

  // Keep the newest message in view — scroll the chat box only, never the page.
  useEffect(() => { const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight; }, [shown.length]);

  const post = async (body: { content: string; imageUrl?: string; audioUrl?: string }) => {
    setBusy(true);
    try {
      await api.post(`/tasks/${taskId}/comments`, {
        ...body,
        workLineId: activeTag?.workLineId ?? undefined,
        tagLabel: activeTag?.label,
      });
      onPosted();
    } catch (e) {
      toast.error(errMsg(e, 'Message not sent'));
    } finally {
      setBusy(false);
    }
  };

  const sendText = async () => {
    if (!text.trim()) return;
    await post({ content: text.trim() });
    setText('');
  };

  return (
    <div className="flex flex-col gap-2.5">
      {labels.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {['', ...labels].map((l) => (
            <button key={l || 'all'} onClick={() => setFilter(l)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11.5px] font-medium ring-1 ${
                filter === l ? 'bg-[#0A573B] text-white ring-[#0A573B]' : 'bg-white text-[#6B7169] ring-[#DDE2DE]'}`}>
              {l || 'All'}
            </button>
          ))}
        </div>
      )}

      <div ref={boxRef} className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto rounded-2xl bg-[#F3F0E8] p-3">
        {shown.length === 0 && <p className="py-6 text-center text-[13px] text-[#9A9E96]">No messages yet — say hello to the team.</p>}
        {shown.map((c) => {
          const mine = myId != null && c.authorId === myId;
          const hideText = c.content === VOICE || c.content === PHOTO;
          return (
            <div key={c.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${mine ? 'rounded-br-md bg-[#0A573B] text-white' : 'rounded-bl-md bg-white text-[#22271F]'}`}>
                {!mine && <p className="text-[11px] font-semibold text-[#9B6B32]">{c.authorName}</p>}
                {c.tagLabel && (
                  <p className={`mb-0.5 inline-flex items-center gap-1 text-[10.5px] font-medium ${mine ? 'text-[#CFE3D6]' : 'text-[#2C7050]'}`}>
                    <Tag className="h-3 w-3" />{c.tagLabel}
                  </p>
                )}
                {c.imageUrl && (
                  <a href={resolveFileUrl(c.imageUrl)} target="_blank" rel="noopener noreferrer">
                    <img src={resolveFileUrl(c.imageUrl)} alt="" className="mt-1 max-h-56 w-full rounded-xl object-cover" />
                  </a>
                )}
                {c.audioUrl && <audio controls src={resolveFileUrl(c.audioUrl)} className="mt-1 h-8 w-56 max-w-full" />}
                {!hideText && <p className="whitespace-pre-wrap text-[13.5px] leading-snug">{c.content}</p>}
                <p className={`mt-0.5 text-right text-[10px] ${mine ? 'text-[#BFD8C8]' : 'text-[#A6A99E]'}`}>{fmtWhen(c.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {locked ? (
        <p className="text-center text-[12px] text-[#9A9E96]">Chat is closed — this task is locked.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {activeTag ? (
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#E6F1EA] px-2.5 py-1 text-[11.5px] font-medium text-[#0A573B]">
              <Tag className="h-3 w-3" /> About: {activeTag.label}
              <button onClick={() => { setLocalTag(null); onClearTag?.(); }} aria-label="Clear tag"><X className="h-3.5 w-3.5" /></button>
            </span>
          ) : tagOptions && tagOptions.length > 0 ? (
            <select value="" onChange={(e) => { const t = tagOptions[Number(e.target.value)]; if (t) setLocalTag(t); }}
              className="self-start rounded-full border border-[#DDE2DE] bg-white px-2.5 py-1 text-[11.5px] text-[#6B7169]">
              <option value="">Tag a product / category…</option>
              {tagOptions.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
            </select>
          ) : null}
          <div className="flex items-center gap-2">
            <PhotoPicker compact disabled={busy} onUploaded={(url) => post({ content: text.trim() || PHOTO, imageUrl: url }).then(() => setText(''))} />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the team…"
              onKeyDown={(e) => { if (e.key === 'Enter') sendText(); }} className={`${INPUT} flex-1 rounded-full`} />
            <button onClick={sendText} disabled={busy || !text.trim()} aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0A573B] text-white active:scale-95 disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </div>
          <div className="[&_label]:text-[11.5px]">
            <AudioCaptureField value={voice} module="PROJECT_WORK" label="Voice message"
              onChange={(next) => { const clip = next[next.length - 1]; if (clip) post({ content: VOICE, audioUrl: clip.url }); setVoice([]); }} />
          </div>
        </div>
      )}
    </div>
  );
}
