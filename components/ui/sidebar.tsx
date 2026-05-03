'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, VariantProps } from 'class-variance-authority'
import { PanelLeftIcon } from 'lucide-react'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const SIDEBAR_WIDTH = '14rem'
const SIDEBAR_WIDTH_ICON = '3rem'

type SidebarContextProps = {
  state: 'expanded' | 'collapsed'
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) throw new Error('useSidebar must be used within a SidebarProvider.')
  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open

  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value
      if (setOpenProp) setOpenProp(openState)
      else _setOpen(openState)
    },
    [setOpenProp, open],
  )

  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  const state: SidebarContextProps['state'] = open ? 'expanded' : 'collapsed'
  const contextValue = React.useMemo(() => ({ state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }), [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar])

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div 
          style={{ 
            '--sidebar-width': SIDEBAR_WIDTH, 
            '--sidebar-width-icon': SIDEBAR_WIDTH_ICON, 
            ...style 
          } as React.CSSProperties} 
          className={cn('group/sidebar-wrapper flex min-h-screen w-full', className)} 
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

function Sidebar({ 
  side = 'left', 
  variant = 'sidebar', 
  collapsible = 'icon', // 기본값을 icon으로 설정하여 접혔을 때 아이콘이 남게 함
  className, 
  children, 
  ...props 
}: React.ComponentProps<'div'> & { 
  side?: 'left' | 'right'; 
  variant?: 'sidebar' | 'floating' | 'inset'; 
  collapsible?: 'offcanvas' | 'icon' | 'none' 
}) {
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar()

  // 모바일: Sheet 드로어로 표시
  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          side="left"
          className="w-[var(--sidebar-width)] p-0 [&>button]:hidden bg-white dark:bg-neutral-900 border-r border-border dark:border-neutral-800"
        >
          <div className="flex h-full w-full flex-col overflow-hidden">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div 
      className="group peer hidden md:block" 
      data-state={state} 
      data-collapsible={state === 'collapsed' ? collapsible : ''} 
      data-variant={variant} 
      data-side={side}
    >
      {/* 사이드바가 차지하는 레이아웃상의 공간 조절 */}
      <div
        className={cn(
          'relative h-screen w-[var(--sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[state=collapsed]:w-[var(--sidebar-width-icon)]'
        )}
      />
      {/* 실제 보이는 고정된 사이드바 본체 */}
      <div
        className={cn(
          'fixed inset-y-0 z-10 flex h-screen w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear',
          side === 'left' 
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]' 
            : 'right-0',
          'group-data-[state=collapsed]:w-[var(--sidebar-width-icon)]',
          className
        )}
        {...props}
      >
        <div className="bg-white dark:bg-neutral-900 border-r border-border dark:border-neutral-800 flex h-full w-full flex-col shadow-sm overflow-hidden overflow-x-hidden">
  {children}
</div>
      </div>
    </div>
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<'main'>) {
  return <main className={cn('relative flex flex-1 flex-col w-full bg-background min-h-screen overflow-x-hidden', className)} {...props} />
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className={cn('size-8', className)} 
      onClick={(e) => { 
        onClick?.(e); 
        toggleSidebar(); 
      }} 
      {...props}
    >
      <PanelLeftIcon className="h-5 w-5" />
    </Button>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 px-6 py-8', className)} {...props} />
}

function SidebarContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-1 flex-col gap-4 overflow-auto px-4', className)} {...props} />
}

function SidebarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex w-full flex-col py-2', className)} {...props} />
}

/**
 * 영업 로드맵 등 그룹의 레이블
 * text-xs -> text-sm으로 변경, font-bold 추가하여 크기를 키움
 */
function SidebarGroupLabel({ className, ...props }: React.ComponentProps<'div'>) {
  const { state } = useSidebar()
  return (
    <div 
      className={cn(
        'px-3 text-sm font-bold text-gray-500 dark:text-neutral-600 uppercase tracking-wider mb-2 transition-opacity duration-200',
        state === 'collapsed' ? 'opacity-0' : 'opacity-100', // 접혔을 때 텍스트 안보이게 처리
        className
      )} 
      {...props} 
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul className={cn('flex w-full flex-col gap-1', className)} {...props} />
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={cn('relative', className)} {...props} />
}


const sidebarMenuButtonVariants = cva(
  'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-medium transition-all hover:bg-gray-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 active:bg-gray-200 dark:active:opacity-80 overflow-hidden whitespace-nowrap',
  {
    variants: {
      isActive: {
        true: 'bg-gray-100 text-[#111827] font-bold shadow-sm dark:bg-indigo-500/10 dark:text-indigo-400 dark:font-semibold dark:shadow-none dark:rounded-r-none dark:border-r-2 dark:border-indigo-500',
        false: 'text-gray-500 dark:text-neutral-500',
      },
    },
    defaultVariants: { isActive: false },
  }
)

function SidebarMenuButton({ isActive, className, asChild, ...props }: React.ComponentProps<'button'> & { isActive?: boolean; asChild?: boolean }) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(sidebarMenuButtonVariants({ isActive }), className)} {...props} />
}

function SidebarSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mx-2 my-2 h-px bg-gray-100 dark:bg-neutral-800', className)} {...props} />
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul className={cn('ml-8 mt-1 flex flex-col gap-1 border-l border-gray-100 pl-2', className)} {...props} />
}

function SidebarMenuSubItem({ ...props }: React.ComponentProps<'li'>) {
  return <li {...props} />
}

function SidebarMenuSubButton({ isActive, className, ...props }: React.ComponentProps<'button'> & { isActive?: boolean }) {
  return (
    <button 
      className={cn(
        'flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-500 hover:text-[#111827] hover:bg-gray-50', 
        isActive && 'text-[#111827] font-semibold', 
        className
      )} 
      {...props} 
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
}