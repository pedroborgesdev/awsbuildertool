interface LoaderProps {
  className?: string
}

export function Loader({ className = 'size-32' }: LoaderProps) {
  return <img className={`block ${className}`} src="/loader.svg" alt="" aria-hidden="true" />
}
