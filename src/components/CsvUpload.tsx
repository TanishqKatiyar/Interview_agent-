'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  Download,
  X,
  Loader2,
  Check,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CandidateRow {
  row: number;
  name: string;
  email: string;
  issue: string | null;
  status: 'ready' | 'sending' | 'sent' | 'failed';
  error?: string;
  url?: string;
}

interface BulkResult {
  name: string;
  email: string;
  success: boolean;
  interview_url?: string;
  error?: string;
}

// ─── CSV parser ─────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseField(raw: string): string {
  let s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  s = s.replace(/""/g, '"');
  return s.trim();
}

function parseCsv(text: string): CandidateRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(',').map((h) => parseField(h));
  let nameIdx = header.findIndex((h) =>
    ['name', 'candidate_name', 'candidate name', 'full_name', 'full name'].includes(h),
  );
  let emailIdx = header.findIndex((h) =>
    ['email', 'candidate_email', 'candidate email', 'email_address', 'email address'].includes(h),
  );

  if (nameIdx === -1 && emailIdx === -1 && header.length >= 2) {
    nameIdx = 0;
    emailIdx = 1;
  }

  if (nameIdx === -1 || emailIdx === -1) return [];

  const seenEmails = new Set<string>();
  const rows: CandidateRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const name = parseField(cols[nameIdx] ?? '');
    const email = parseField(cols[emailIdx] ?? '').toLowerCase();

    let issue: string | null = null;

    if (!name) {
      issue = 'Name missing';
    } else if (!email) {
      issue = 'Email missing';
    } else if (!EMAIL_RE.test(email)) {
      issue = 'Invalid email';
    } else if (seenEmails.has(email)) {
      issue = 'Duplicate';
    }

    if (email) seenEmails.add(email);

    rows.push({ row: i, name, email, issue, status: 'ready' });
  }

  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Download template ──────────────────────────────────────────────────────

function downloadTemplate() {
  const csv = 'name,email\nPriya Sharma,priya@example.com\nRahul Verma,rahul@example.com\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'invite-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ═════════════════════════════════════════════════════════════════════════════

interface CsvUploadProps {
  onComplete: () => void;
}

export default function CsvUpload({ onComplete }: CsvUploadProps) {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<{ sent: number; failed: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter((r) => !r.issue);
  const issueRows = rows.filter((r) => !!r.issue);

  const handleFile = useCallback((file: File) => {
    setParseError('');
    setSummary(null);
    setProgress(0);

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a .csv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text || text.trim().length === 0) {
        setParseError('The file is empty.');
        return;
      }

      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setParseError('Could not find name and email columns. Make sure your CSV has headers: name, email');
        return;
      }
      if (parsed.length > 100) {
        setParseError(`Too many rows (${parsed.length}). Maximum is 100 per batch.`);
        return;
      }

      setRows(parsed);
      setFileName(file.name);
    };
    reader.readAsText(file);
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSend = async () => {
    if (sending || validRows.length === 0) return;
    setSending(true);
    setProgress(0);
    setSummary(null);

    setRows((prev) =>
      prev.map((r) => (r.issue ? r : { ...r, status: 'sending' as const })),
    );

    try {
      const candidates = validRows.map((r) => ({ name: r.name, email: r.email }));

      const res = await fetch('/api/interviews/bulk-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates, send_email: sendEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setParseError(data.error || 'Bulk invite failed.');
        setSending(false);
        return;
      }

      const results: BulkResult[] = data.results;
      setRows((prev) => {
        const updated = [...prev];
        let resultIdx = 0;
        for (let i = 0; i < updated.length; i++) {
          if (!updated[i].issue && resultIdx < results.length) {
            const r = results[resultIdx];
            updated[i] = {
              ...updated[i],
              status: r.success ? 'sent' : 'failed',
              error: r.error,
              url: r.interview_url,
            };
            resultIdx++;
          }
        }
        return updated;
      });

      setProgress(100);
      setSummary({ sent: data.sent, failed: data.failed });
      onComplete();
    } catch (err) {
      console.error(err);
      setParseError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setRows([]);
    setFileName('');
    setParseError('');
    setSummary(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  const rowChipClasses = (r: CandidateRow): string => {
    if (r.issue) {
      const isRed = r.issue === 'Invalid email' || r.issue === 'Email missing';
      return isRed ? 'bg-tangerine/15 text-tangerine' : 'bg-sunshine text-ink';
    }
    switch (r.status) {
      case 'sent':
        return 'bg-accent text-paper';
      case 'failed':
        return 'bg-tangerine/15 text-tangerine';
      case 'sending':
        return 'bg-ink text-paper';
      default:
        return 'bg-paper-muted text-ink-soft';
    }
  };

  const rowLabel = (r: CandidateRow): string => {
    if (r.issue) return r.issue;
    switch (r.status) {
      case 'sent':
        return 'Sent';
      case 'failed':
        return r.error || 'Failed';
      case 'sending':
        return 'Sending';
      default:
        return 'Ready';
    }
  };

  return (
    <section className="border border-ink/15 rounded-[4px] p-5 sm:p-7 bg-paper-deep/40">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-soft">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Bulk · 02
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft hidden sm:inline">
          Up to 100 / batch
        </span>
      </div>

      {/* No file yet: drop zone */}
      {rows.length === 0 && (
        <>
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={
              'border-[1.5px] border-dashed rounded-[4px] px-6 py-12 text-center cursor-pointer transition ' +
              (dragging ? 'border-accent bg-accent/5' : 'border-ink/25 bg-paper hover:border-ink/40')
            }
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-paper-deep mb-4">
              <Upload className="w-5 h-5 text-ink" strokeWidth={1.8} />
            </div>
            <p className="font-display text-[17px] font-semibold text-ink tracking-[-0.01em] mb-1">
              Drop your CSV here — or click to browse
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              Columns · name, email
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="hidden"
          />

          <div className="mt-4 text-center">
            <button
              onClick={downloadTemplate}
              type="button"
              className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:text-accent-deep transition"
            >
              <Download className="w-3 h-3" strokeWidth={2} />
              Download template
            </button>
          </div>

          {parseError && (
            <div className="mt-4 border-l-[3px] border-tangerine bg-tangerine/10 px-4 py-3 rounded-[4px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-tangerine mt-0.5 shrink-0" strokeWidth={2} />
              <p className="font-display text-[15px] text-ink">{parseError}</p>
            </div>
          )}
        </>
      )}

      {/* File loaded */}
      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4 text-ink-soft" strokeWidth={1.8} />
              <span className="font-display text-[15px] font-medium text-ink">{fileName}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                · {validRows.length} valid
                {issueRows.length > 0 && (
                  <span className="text-tangerine"> · {issueRows.length} issue{issueRows.length !== 1 ? 's' : ''}</span>
                )}
              </span>
            </div>
            <button
              onClick={reset}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ink/20 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft hover:bg-ink hover:text-paper hover:border-ink transition"
            >
              <X className="w-3 h-3" strokeWidth={2.2} />
              Remove
            </button>
          </div>

          {/* Preview table */}
          <div className="border border-ink/15 rounded-[4px] overflow-hidden mb-4 max-h-[320px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-ink/15 bg-paper-deep">
                  {['/ #', '/ Name', '/ Email', '/ Status'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  return (
                    <tr
                      key={r.row}
                      className="border-t border-ink/10 hover:bg-paper-deep/40 transition"
                    >
                      <td className="px-3 py-2.5 font-mono text-[11px] tnum text-ink-soft">
                        {String(r.row).padStart(2, '0')}
                      </td>
                      <td className="px-3 py-2.5 font-display text-[14px] text-ink">
                        {r.name || <span className="italic text-tangerine">—</span>}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-ink-muted">
                        {r.email || <span className="italic text-tangerine">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={
                            'inline-flex items-center px-2 py-[3px] rounded-full font-mono text-[9px] uppercase tracking-[0.18em] ' +
                            rowChipClasses(r)
                          }
                        >
                          {rowLabel(r)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {parseError && (
            <div className="mb-4 border-l-[3px] border-tangerine bg-tangerine/10 px-4 py-3 rounded-[4px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-tangerine mt-0.5 shrink-0" strokeWidth={2} />
              <p className="font-display text-[15px] text-ink">{parseError}</p>
            </div>
          )}

          {summary && (
            <div
              className={
                'mb-4 px-4 py-3 rounded-[4px] border-l-[3px] flex items-center gap-2 ' +
                (summary.failed > 0
                  ? 'border-tangerine bg-tangerine/10'
                  : 'border-accent bg-accent/5')
              }
            >
              <Check className="w-4 h-4 text-accent" strokeWidth={2.5} />
              <span className="font-display text-[15px] text-ink">
                {summary.sent} invitation{summary.sent !== 1 ? 's' : ''} sent
              </span>
              {summary.failed > 0 && (
                <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-tangerine">
                  · {summary.failed} failed
                </span>
              )}
            </div>
          )}

          {sending && (
            <div className="h-[3px] rounded-full bg-ink/10 overflow-hidden mb-4">
              <div className="h-full bg-accent animate-pulse" style={{ width: '60%' }} />
            </div>
          )}

          {/* Controls */}
          {!summary && (
            <div className="flex items-center gap-4 flex-wrap">
              <label className="inline-flex items-center gap-2 font-display text-[14px] text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-4 h-4 accent-accent cursor-pointer"
                />
                Send invitation emails
              </label>

              <button
                onClick={handleSend}
                disabled={sending || validRows.length === 0}
                type="button"
                className={
                  'inline-flex items-center gap-2 pl-5 pr-2 py-2 rounded-full font-display font-semibold text-[15px] transition ' +
                  (sending || validRows.length === 0
                    ? 'bg-ink/30 text-paper cursor-not-allowed'
                    : 'bg-accent text-paper hover:bg-accent-deep')
                }
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                    Sending…
                  </>
                ) : (
                  <>
                    Send {validRows.length} invitation{validRows.length !== 1 ? 's' : ''}
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-paper text-accent">
                      →
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
