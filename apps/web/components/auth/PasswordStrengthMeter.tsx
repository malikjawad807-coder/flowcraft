'use client';

import React from 'react';

interface Props {
  password: string;
}

export function calculatePasswordStrength(password: string): {
  score: number;
  label: string;
} {
  if (!password) {
    return { score: 0, label: '' };
  }

  if (password.length < 10) {
    return { score: 1, label: 'Too short (min 10 characters)' };
  }

  let points = 1;
  if (password.length >= 14) points += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) points += 1;
  if (/\d/.test(password)) points += 1;
  if (/[^A-Za-z0-9]/.test(password)) points += 1;

  // Normalize points to a 1-4 scale
  const score = Math.min(4, Math.max(1, points - 1));

  const labels = [
    '',
    'Weak',
    'Fair',
    'Good',
    'Strong',
  ];

  return { score, label: labels[score] };
}

export function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null;

  const { score, label } = calculatePasswordStrength(password);

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1.5 h-1.5">
        {[1, 2, 3, 4].map((step) => {
          const active = step <= score;
          return (
            <div
              key={step}
              className={`flex-1 rounded-full transition-all duration-300 ${
                active
                  ? score <= 2
                    ? 'bg-red'
                    : 'bg-red-hover'
                  : 'bg-surface-2 border border-border/40'
              }`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-muted">Strength:</span>
        <span
          className={`font-medium ${
            score <= 1 ? 'text-red' : score === 2 ? 'text-text/80' : 'text-text'
          }`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
