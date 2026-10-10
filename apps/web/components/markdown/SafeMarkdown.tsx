'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

export function SafeMarkdown({ content, className = '' }: SafeMarkdownProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Parse lines into tokens: code blocks vs text blocks
  const blocks: Array<{ type: 'code' | 'text'; content: string; lang?: string }> = [];
  const lines = content.split('\n');

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = '';
  let textBuffer: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        if (textBuffer.length > 0) {
          blocks.push({ type: 'text', content: textBuffer.join('\n') });
          textBuffer = [];
        }
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeBuffer = [];
      } else {
        inCodeBlock = false;
        blocks.push({ type: 'code', content: codeBuffer.join('\n'), lang: codeLang });
        codeBuffer = [];
        codeLang = '';
      }
    } else if (inCodeBlock) {
      codeBuffer.push(line);
    } else {
      textBuffer.push(line);
    }
  }

  if (inCodeBlock && codeBuffer.length > 0) {
    blocks.push({ type: 'code', content: codeBuffer.join('\n'), lang: codeLang });
  } else if (textBuffer.length > 0) {
    blocks.push({ type: 'text', content: textBuffer.join('\n') });
  }

  // Safe inline formatter
  const renderInline = (text: string) => {
    // Break by inline code, links, bold, italic
    // We split with regex tokens
    const parts: React.ReactNode[] = [];
    const regex = /(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let lastIdx = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push(text.slice(lastIdx, match.index));
      }

      const token = match[0];
      if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-red-text font-mono text-[11px]"
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="font-semibold text-text">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(
          <em key={match.index} className="italic text-text/90">
            {token.slice(1, -1)}
          </em>
        );
      } else if (token.startsWith('[') && token.includes('](')) {
        const linkText = token.slice(1, token.indexOf(']('));
        const url = token.slice(token.indexOf('](') + 2, -1);
        const isSafeUrl = !url.toLowerCase().startsWith('javascript:');
        parts.push(
          <a
            key={match.index}
            href={isSafeUrl ? url : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-text underline underline-offset-2 hover:text-red transition-colors"
          >
            {linkText}
          </a>
        );
      } else {
        parts.push(token);
      }

      lastIdx = regex.lastIndex;
    }

    if (lastIdx < text.length) {
      parts.push(text.slice(lastIdx));
    }

    return parts;
  };

  return (
    <div className={`space-y-2 text-xs leading-relaxed text-text ${className}`}>
      {blocks.map((block, bIdx) => {
        if (block.type === 'code') {
          return (
            <div
              key={bIdx}
              className="my-2 rounded-card bg-[#0E0E10] border border-border overflow-hidden"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2 border-b border-border text-[11px] font-mono text-muted">
                <span>{block.lang || 'code'}</span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(block.content, bIdx)}
                  className="flex items-center gap-1 hover:text-text transition-colors"
                >
                  {copiedIndex === bIdx ? (
                    <>
                      <Check className="w-3 h-3 text-red-text" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono overflow-x-auto text-text/90">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }

        // Render text block lines
        const blockLines = block.content.split('\n');
        return (
          <div key={bIdx} className="space-y-1.5">
            {blockLines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={lIdx} className="h-1.5" />;
              }

              if (trimmed.startsWith('### ')) {
                return (
                  <h4 key={lIdx} className="text-xs font-semibold text-text mt-2 mb-1">
                    {renderInline(trimmed.slice(4))}
                  </h4>
                );
              }
              if (trimmed.startsWith('## ')) {
                return (
                  <h3 key={lIdx} className="text-sm font-semibold text-text mt-3 mb-1">
                    {renderInline(trimmed.slice(3))}
                  </h3>
                );
              }
              if (trimmed.startsWith('# ')) {
                return (
                  <h2 key={lIdx} className="text-sm font-bold text-text mt-3 mb-1">
                    {renderInline(trimmed.slice(2))}
                  </h2>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-red font-bold select-none">•</span>
                    <span>{renderInline(trimmed.slice(2))}</span>
                  </div>
                );
              }
              if (/^\d+\.\s/.test(trimmed)) {
                const match = trimmed.match(/^(\d+)\.\s(.*)$/);
                const num = match ? match[1] : '1';
                const rest = match ? match[2] : trimmed;
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-muted font-mono select-none">{num}.</span>
                    <span>{renderInline(rest)}</span>
                  </div>
                );
              }
              if (trimmed.startsWith('> ')) {
                return (
                  <div
                    key={lIdx}
                    className="border-l-2 border-red/60 pl-3 py-0.5 text-muted italic bg-surface-2/40 rounded-r"
                  >
                    {renderInline(trimmed.slice(2))}
                  </div>
                );
              }

              return (
                <p key={lIdx} className="leading-relaxed">
                  {renderInline(line)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
