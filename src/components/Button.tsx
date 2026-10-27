import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

type Kind = 'primary' | 'secondary' | 'ghost'
interface Common { children: ReactNode; kind?: Kind; icon?: IconName; className?: string }

export function Button({ children, kind = 'primary', icon, className = '', ...rest }:
  Common & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button className={`button ${kind} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={19} />}
      <span>{children}</span>
    </button>
  )
}

export function LinkButton({ children, kind = 'primary', icon, className = '', href }: Common & { href: string }) {
  return (
    <Link href={href} className={`button ${kind} ${className}`}>
      {icon && <Icon name={icon} size={19} />}
      <span>{children}</span>
    </Link>
  )
}
