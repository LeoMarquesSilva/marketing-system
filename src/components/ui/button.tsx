import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-all outline-none active:translate-y-px focus-visible:border-[#47cdd0] focus-visible:ring-[3px] focus-visible:ring-[#47cdd0]/20 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border border-[#285f7a] bg-[#347796] text-white shadow-[0_2px_8px_rgba(52,119,150,0.22)] hover:border-[#214f66] hover:bg-[#285f7a] hover:text-white hover:shadow-[0_4px_12px_rgba(40,95,122,0.28)]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-[#3e84a8]/25 bg-white text-[#285f7a] shadow-xs hover:border-[#47cdd0]/70 hover:bg-[#47cdd0]/10 hover:text-[#1c1c1c] dark:border-input dark:bg-input/30 dark:text-white dark:hover:bg-input/50",
        secondary:
          "border border-[#47cdd0]/20 bg-[#e8f8f8] text-[#285f7a] hover:border-[#47cdd0]/45 hover:bg-[#d9f3f3]",
        ghost:
          "text-[#315f73] hover:bg-[#47cdd0]/10 hover:text-[#1c1c1c] dark:text-white/80 dark:hover:bg-accent/50",
        link: "text-[#347796] underline-offset-4 hover:text-[#285f7a] hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-8 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-8 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
