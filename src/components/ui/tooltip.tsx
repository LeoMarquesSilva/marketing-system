"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function TooltipProvider({
  delayDuration = 200,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-[200] max-w-[min(20rem,calc(100vw-2rem))] rounded-md border border-[#47cdd0]/30 bg-[#04202f] px-3.5 py-3 text-white shadow-[0_16px_36px_-16px_rgba(3,7,12,0.65)]",
          "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
          "data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-[#04202f]" width={12} height={6} />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

interface InfoTooltipProps {
  title: string;
  description: string;
  side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"];
  className?: string;
}

function InfoTooltip({ title, description, side = "top", className }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex shrink-0 rounded-full p-0.5 text-[#3e84a8] transition-colors",
            "hover:bg-[#47cdd0]/12 hover:text-[#285f7a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/40",
            className
          )}
          aria-label={`Saiba mais sobre ${title}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side}>
        <p className="text-sm font-semibold leading-snug text-[#b7f0f1]">{title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/75">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  InfoTooltip,
};
