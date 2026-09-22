export function PipelineItem({ n, text, active }: { n: string; text: string; active: boolean }) {
  return (
    <li className={`flex items-center gap-3 ${active ? 'text-white' : 'text-muted-light'}`}>
      <span className={`grid h-7 w-7 place-items-center border text-xs ${active ? 'border-green text-green' : 'border-grid'}`}>{n}</span>
      {text}
    </li>
  )
}
