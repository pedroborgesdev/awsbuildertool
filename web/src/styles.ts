export const eyebrowClass = 'text-[11px] font-extrabold tracking-[.18em] uppercase'

export const fieldLabelClass = 'text-xs font-extrabold tracking-[.03em]'

export const fieldControlClass = [
  'w-full min-w-0 max-w-full rounded-none border border-border bg-ink px-3.5 py-[13px] text-white outline-none',
  'transition-[border-color,box-shadow] duration-150 placeholder:text-muted',
  'focus:border-green focus:shadow-[0_0_0_1px_#00e582]',
].join(' ')

export const scrollbarClass = [
  '[scrollbar-width:thin] [scrollbar-color:#42b4ff_#10161e] [scrollbar-gutter:stable]',
  '[&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar]:w-3',
  '[&::-webkit-scrollbar-track]:bg-code',
  '[&::-webkit-scrollbar-thumb]:min-h-11 [&::-webkit-scrollbar-thumb]:rounded-none',
  '[&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-code [&::-webkit-scrollbar-thumb]:bg-blue',
  '[&::-webkit-scrollbar-thumb:hover]:bg-pink [&::-webkit-scrollbar-corner]:bg-code',
].join(' ')

export const choiceCardClass = [
  'cursor-pointer w-full min-h-22 [overflow-wrap:anywhere] border border-border bg-ink p-3 text-left text-inherit',
  'transition-[border-color,background-color,box-shadow] duration-150 hover:border-muted-light',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green',
].join(' ')

export const panelGridClass = 'grid gap-[22px]'

export const gridBackgroundClass = [
  'bg-ink',
  '[background-image:linear-gradient(to_right,rgba(66,180,255,.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(66,180,255,.15)_1px,transparent_1px)]',
].join(' ')
