import React from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from '@xyflow/react';

export function WorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isRunning = data?.isRunning;
  const isSuccess = data?.isSuccess;

  let strokeColor = '#475569';
  if (selected) strokeColor = '#ff6d5a';
  if (isRunning) strokeColor = '#a855f7';
  if (isSuccess) strokeColor = '#10b981';

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth: selected ? 3 : 2,
          transition: 'stroke 0.3s ease, stroke-width 0.2s ease',
        }}
        className={isRunning ? 'edge-animated' : ''}
      />
      {isRunning && (
        <circle r="4" fill="#c084fc">
          <animateMotion dur="1.2s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
      {typeof (data as any)?.label === 'string' && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-slate-900/90 text-slate-300 border border-slate-700 backdrop-blur-sm shadow-sm"
          >
            {(data as any).label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
