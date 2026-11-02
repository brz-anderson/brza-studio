import { cn } from '@/lib/utils'

export function BrzaWordmark({
  daughter,
  layout = 'horizontal',
  className
}: {
  daughter?: 'Studio' | 'CLI' | 'Workspace'
  layout?: 'horizontal' | 'vertical'
  className?: string
}): React.JSX.Element {
  return (
    <span
      className={cn('brza-wordmark', layout === 'vertical' && 'brza-wordmark--vertical', className)}
      aria-label={daughter ? `BrzA ${daughter}` : 'BrzA'}
    >
      <span aria-hidden="true" className="brza-wordmark-mother">
        Brz<span className="brza-wordmark-a">A</span>
      </span>
      {daughter ? (
        <span aria-hidden="true" className="brza-wordmark-daughter">
          {daughter}
        </span>
      ) : null}
    </span>
  )
}
