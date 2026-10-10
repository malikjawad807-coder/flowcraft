'use client';

import React, { useState } from 'react';
import { Copy, Check, ChevronRight, ChevronDown } from 'lucide-react';

interface JsonViewerProps {
  data: any;
  title?: string;
  defaultExpanded?: boolean;
}

export function JsonViewer({ data, title, defaultExpanded = false }: JsonViewerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const getSummary = (val: any): string => {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'string') return `"${val.slice(0, 40)}${val.length > 40 ? '...' : ''}"`;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return `Array(${val.length})`;
    if (typeof val === 'object') {
      const keys = Object.keys(val);
      return `{ ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''} } (${keys.length} keys)`;
    }
    return String(val);
  };

  const renderJsonTree = (val: any, depth = 0): React.ReactNode => {
    if (val === null) return <span className="text-muted">null</span>;
    if (val === undefined) return <span className="text-muted">undefined</span>;
    if (typeof val === 'boolean') return <span className="text-red-text">{String(val)}</span>;
    if (typeof val === 'number') return <span className="text-white font-mono">{val}</span>;
    if (typeof val === 'string') {
      return (
        <span className="text-[#E0E0E6] break-all">
          &quot;{val}&quot;
        </span>
      );
    }

    if (Array.isArray(val)) {
      if (val.length === 0) return <span className="text-muted">[]</span>;
      return (
        <div className="pl-4 border-l border-border/50 space-y-1 my-0.5">
          {val.map((item, idx) => (
            <div key={idx} className="text-xs font-mono">
              <span className="text-muted mr-1.5 select-none">{idx}:</span>
              {renderJsonTree(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof val === 'object') {
      const entries = Object.entries(val);
      if (entries.length === 0) return <span className="text-muted">&#123;&#125;</span>;
      return (
        <div className="pl-4 border-l border-border/50 space-y-1 my-0.5">
          {entries.map(([key, item]) => (
            <div key={key} className="text-xs font-mono">
              <span className="text-red-text mr-1.5 select-none">&quot;{key}&quot;:</span>
              {renderJsonTree(item, depth + 1)}
            </div>
          ))}
        </div>
      );
    }

    return <span>{String(val)}</span>;
  };

  return (
    <div className="border border-border rounded-btn bg-[#121214] overflow-hidden text-xs font-mono">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3 py-2 bg-surface-2 hover:bg-[#202025] cursor-pointer select-none transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted flex-shrink-0" />
          )}
          {title && <span className="font-semibold text-text">{title}</span>}
          {!isExpanded && (
            <span className="text-[11px] text-muted truncate max-w-xs">{getSummary(data)}</span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="p-1 text-muted hover:text-text rounded hover:bg-border/60 transition-colors flex items-center gap-1 text-[11px]"
          title="Copy raw JSON"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-text" />
              <span className="text-text">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 bg-[#0D0D0F] max-h-96 overflow-auto">
          {renderJsonTree(data)}
        </div>
      )}
    </div>
  );
}
