import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans text-[16px] font-medium tracking-tight2 ring-offset-background transition-[transform,background-color,color,border-color] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* Mastercard primary — ink-pill */
        ink: "rounded-[20px] border-[1.5px] border-ink bg-ink text-canvas hover:bg-ink/90",
        /* Mastercard secondary — outlined-pill on cream/lifted */
        outlined:
          "rounded-[20px] border-[1.5px] border-ink bg-transparent text-ink hover:bg-ink/5",
        /* Aggressive consent / destructive */
        signal: "rounded-[24px] bg-signal text-white hover:bg-signal/90 border-0",
        /* Round icon button (sign-out, drawer-close, etc.) */
        iconCircle:
          "rounded-pill bg-ink text-canvas hover:scale-[1.05] border-0 [&_svg]:size-4",

        /* shadcn-compatible aliases (kept so existing call sites still work) */
        default: "rounded-[20px] border-[1.5px] border-ink bg-ink text-canvas hover:bg-ink/90",
        destructive: "rounded-[20px] bg-signal text-white hover:bg-signal/90",
        outline:
          "rounded-[20px] border-[1.5px] border-ink bg-transparent text-ink hover:bg-ink/5",
        secondary:
          "rounded-[20px] bg-lifted text-ink hover:bg-lifted/80 border border-border",
        ghost: "rounded-[20px] text-ink hover:bg-ink/5",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2",
        sm: "h-9 px-4",
        lg: "h-11 px-8",
        icon: "h-10 w-10 p-0",
        iconLg: "h-12 w-12 p-0",
      },
    },
    defaultVariants: { variant: "ink", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
