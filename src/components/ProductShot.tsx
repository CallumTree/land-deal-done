import { cn } from "@/lib/utils";

interface ProductShotProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** Portion of the screenshot visible before it's cropped by the frame. */
  focus?: "top" | "center";
}

/**
 * Frames a real product screenshot in a lightweight browser-chrome card —
 * used instead of stock photography so marketing surfaces show the actual
 * app rather than generic imagery.
 */
const ProductShot = ({ src, alt, className, imgClassName, focus = "top" }: ProductShotProps) => (
  <div className={cn("rounded-xl border bg-card shadow-large overflow-hidden", className)}>
    <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b bg-muted/50">
      <span className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
      <span className="h-2.5 w-2.5 rounded-full bg-warning/50" />
      <span className="h-2.5 w-2.5 rounded-full bg-success/50" />
    </div>
    <div className="overflow-hidden">
      <img
        src={src}
        alt={alt}
        className={cn("w-full h-auto", focus === "top" ? "object-top" : "object-center", imgClassName)}
      />
    </div>
  </div>
);

export default ProductShot;
