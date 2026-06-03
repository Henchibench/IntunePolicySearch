import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* Fluent primary — brand blue */
        ink: "rounded-md bg-primary text-primary-foreground hover:bg-primary/90",
        /* Fluent default — Surface 1 with neutral stroke */
        outlined:
          "rounded-md border border-border bg-card text-foreground hover:bg-muted",
        /* Destructive */
        signal: "rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 border-0",
        /* Icon button (sign-out, drawer-close, etc.) */
        iconCircle:
          "rounded-md bg-transparent text-foreground hover:bg-muted border-0 [&_svg]:size-4",

        /* shadcn-compatible aliases (kept so existing call sites still work) */
        default: "rounded-md bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "rounded-md border border-border bg-card text-foreground hover:bg-muted",
        secondary:
          "rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
        ghost: "rounded-md text-foreground hover:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 min-w-[96px]",
        sm: "h-6 px-2",
        lg: "h-10 px-4",
        icon: "h-8 w-8 p-0",
        iconLg: "h-10 w-10 p-0",
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
