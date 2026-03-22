import React, { useMemo, useRef } from 'react'
import { QuestionLogicItem } from '../../types/question'

export interface GraphQuestion {
  id: string
  dbId?: number
  question_text: string
  identifier: string
  question_type: string
  is_required: boolean
}

interface Props {
  questionLogic: QuestionLogicItem[]
  questions: GraphQuestion[]
  groupName: string
  onClose: () => void
}

const NODE_W = 210, NODE_H = 50, COND_W = 230, COND_H = 56
const V_GAP = 44, H_BRANCH = 280, MARGIN = 50

interface GNode {
  id: string; type: 'question' | 'conditional'
  label: string; sublabel: string; issues: string[]
  x: number; y: number; w: number; h: number
}
interface GEdge {
  key: string; path: string; label?: string
  labelX?: number; labelY?: number; color: string
}

function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s }

function findQ(item: QuestionLogicItem, qs: GraphQuestion[]) {
  return qs.find(q =>
    (item.localQuestionId != null && q.id === item.localQuestionId) ||
    (item.questionId != null && q.dbId != null && q.dbId === item.questionId)
  )
}

function vEdge(x1: number, y1: number, x2: number, y2: number) {
  const m = (y1 + y2) / 2
  return `M${x1},${y1} C${x1},${m} ${x2},${m} ${x2},${y2}`
}

function lEdge(x1: number, y1: number, x2: number, y2: number) {
  const r = 12
  if (x2 > x1 + r && y2 > y1 + r)
    return `M${x1},${y1} H${x2 - r} Q${x2},${y1} ${x2},${y1 + r} V${y2}`
  return `M${x1},${y1} L${x2},${y2}`
}

function layoutItems(
  items: QuestionLogicItem[], cx: number, sy: number,
  nodes: GNode[], edges: GEdge[], qs: GraphQuestion[], ids: Set<string>
): { endY: number; maxR: number } {
  let cy = sy, maxR = cx + NODE_W / 2
  let prev: { x: number; y: number } | null = null

  for (const item of items) {
    if (item.type === 'question') {
      const q = findQ(item, qs)
      const issues: string[] = []
      if (!q?.question_text?.trim()) issues.push('Empty question text')
      if (!q?.identifier?.trim()) issues.push('Missing identifier')
      nodes.push({ id: item.id, type: 'question',
        label: q?.identifier ? trunc(q.identifier, 26) : '(no identifier)',
        sublabel: q?.question_text ? trunc(q.question_text, 30) : '(no text)',
        issues, x: cx - NODE_W / 2, y: cy, w: NODE_W, h: NODE_H })
      if (prev) edges.push({ key: `e-${item.id}`, path: vEdge(prev.x, prev.y, cx, cy), color: '#94a3b8' })
      prev = { x: cx, y: cy + NODE_H }
      cy += NODE_H + V_GAP
      maxR = Math.max(maxR, cx + NODE_W / 2)
    } else if (item.type === 'conditional' && item.conditional) {
      const c = item.conditional
      const issues: string[] = []
      if (!c.ifIdentifier?.trim()) issues.push('Missing IF identifier')
      else if (!ids.has(c.ifIdentifier)) issues.push(`Unknown identifier "${c.ifIdentifier}"`)
      if (!c.value?.trim()) issues.push('Missing condition value')
      if (!c.nestedItems?.length) issues.push('Empty branch — no nested items')
      const op = c.operator || 'equals'
      nodes.push({ id: item.id, type: 'conditional',
        label: `IF ${trunc(c.ifIdentifier || '???', 22)}`,
        sublabel: `${op} "${trunc(c.value || '???', 18)}"`,
        issues, x: cx - COND_W / 2, y: cy, w: COND_W, h: COND_H })
      if (prev) edges.push({ key: `e-${item.id}`, path: vEdge(prev.x, prev.y, cx, cy), color: '#94a3b8' })
      const cBot = cy + COND_H
      let bEnd = cBot
      if (c.nestedItems?.length) {
        const bCX = cx + H_BRANCH, bSY = cBot + V_GAP * 0.65
        const sx = cx + COND_W / 2, sy2 = cy + COND_H / 2
        edges.push({ key: `e-${item.id}-yes`, path: lEdge(sx, sy2, bCX, bSY),
          label: 'YES', labelX: (sx + bCX) / 2, labelY: sy2 - 8, color: '#059669' })
        const br = layoutItems(c.nestedItems, bCX, bSY, nodes, edges, qs, ids)
        bEnd = Math.max(cBot, br.endY)
        maxR = Math.max(maxR, br.maxR)
      }
      prev = { x: cx, y: cBot }
      cy = bEnd + V_GAP
      maxR = Math.max(maxR, cx + COND_W / 2)
    }
  }
  return { endY: prev ? prev.y : sy, maxR }
}

// PLACEHOLDER_COMPONENT
const QuestionGroupGraph: React.FC<Props> = ({ questionLogic, questions, groupName, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const layout = useMemo(() => {
    const ns: GNode[] = [], es: GEdge[] = []
    const ids = new Set(questions.map(q => q.identifier).filter(Boolean))
    const r = layoutItems(questionLogic, MARGIN + COND_W / 2, MARGIN, ns, es, questions, ids)
    const issues: { nodeLabel: string; issue: string }[] = []
    let qC = 0, cC = 0
    for (const n of ns) {
      if (n.type === 'question') qC++; else cC++
      for (const i of n.issues) issues.push({ nodeLabel: n.label, issue: i })
    }
    return { nodes: ns, edges: es, w: Math.max(r.maxR + MARGIN, 500),
      h: Math.max(r.endY + MARGIN + 20, 300), issues, qC, cC }
  }, [questionLogic, questions])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1.25rem', background: 'white', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{groupName} — Flow Graph</h2>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{layout.qC} questions · {layout.cC} conditionals</span>
          {layout.issues.length > 0
            ? <span style={{ background: '#fef2f2', color: '#dc2626', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>{layout.issues.length} issue{layout.issues.length !== 1 ? 's' : ''}</span>
            : <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>No issues</span>}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}>✕ Close</button>
      </div>
      {layout.issues.length > 0 && (
        <div style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', padding: '0.5rem 1.25rem', maxHeight: '120px', overflow: 'auto' }}>
          {layout.issues.map((iss, i) => (
            <div key={i} style={{ fontSize: '0.75rem', color: '#991b1b', padding: '0.1rem 0' }}>
              <strong>{iss.nodeLabel}:</strong> {iss.issue}
            </div>
          ))}
        </div>
      )}
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', background: '#f8fafc', backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        <svg width={layout.w} height={layout.h} style={{ display: 'block' }}>
          <defs>
            <marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#94a3b8" /></marker>
            <marker id="arr-g" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6Z" fill="#059669" /></marker>
          </defs>
          {layout.edges.map(e => (
            <g key={e.key}>
              <path d={e.path} fill="none" stroke={e.color} strokeWidth={2} markerEnd={e.color === '#059669' ? 'url(#arr-g)' : 'url(#arr)'} />
              {e.label && e.labelX != null && e.labelY != null && (
                <text x={e.labelX} y={e.labelY} textAnchor="middle" fontSize="11" fontWeight="600" fill={e.color}>{e.label}</text>
              )}
            </g>
          ))}
          {layout.nodes.map(n => {
            const bad = n.issues.length > 0
            const fill = bad ? '#fef2f2' : n.type === 'conditional' ? '#faf5ff' : '#ffffff'
            const stroke = bad ? '#dc2626' : n.type === 'conditional' ? '#7c3aed' : '#2563eb'
            return (
              <g key={n.id}>
                <rect x={n.x + 2} y={n.y + 2} width={n.w} height={n.h} rx={8} fill="rgba(0,0,0,0.06)" />
                <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={8} fill={fill} stroke={stroke} strokeWidth={1.5} />
                <rect x={n.x} y={n.y} width={4} height={n.h} rx={2} fill={stroke} />
                <text x={n.x + 14} y={n.y + 12} fontSize="9" fill={stroke} fontWeight="700">{n.type === 'conditional' ? 'IF' : 'Q'}</text>
                <text x={n.x + 14} y={n.y + n.h / 2 - 2} fontSize="12" fontWeight="600" fill="#1e293b">{n.label}</text>
                <text x={n.x + 14} y={n.y + n.h / 2 + 14} fontSize="10" fill="#64748b">{n.sublabel}</text>
                {bad && <><circle cx={n.x + n.w - 14} cy={n.y + 14} r={8} fill="#dc2626" /><text x={n.x + n.w - 14} y={n.y + 18} textAnchor="middle" fontSize="10" fill="white" fontWeight="700">!</text></>}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

export default QuestionGroupGraph
