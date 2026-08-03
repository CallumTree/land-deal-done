import { Button } from "@/components/ui/button";
import { ArrowRight, Rocket } from "lucide-react";

const CtaSection = () => {
  return (
    <section className="py-16 sm:py-24 bg-muted/40" id="get-started">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-success/10 text-success px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            <Rocket className="w-4 h-4" />
            Free while in beta
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Run your first feasibility check today
          </h2>

          <p className="text-lg text-muted-foreground mb-8">
            No credit card, no sales call. Create an account and draw your first site in under two minutes.
          </p>

          <Button variant="cta" size="lg" className="text-base px-8 py-6 h-auto" asChild>
            <a href="/auth">
              Get Started Free
              <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;
