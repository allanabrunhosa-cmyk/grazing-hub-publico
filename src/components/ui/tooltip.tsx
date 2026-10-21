"use client";

import { Tooltip as Primitive } from "@base-ui/react/tooltip";
import { cn } from "cn";

export function Tooltip(props: Primitive.Root.Props) { return <Primitive.Root {...props} />; }
export function TooltipTrigger(props: Primitive.Trigger.Props) { return <Primitive.Trigger {...props} />; }
export function TooltipContent({ className, children, ...props }: Primitive.Popup.Props) {
  return <Primitive.Portal><Primitive.Positioner side="right" sideOffset={8} className="isolate z-50">
    <Primitive.Popup data-slot="tooltip-content" className={cn("max-w-64 rounded-[var(--ds-popup-raio)] border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md", className)} {...props}>{children}</Primitive.Popup>
  </Primitive.Positioner></Primitive.Portal>;
}
