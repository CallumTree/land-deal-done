import { Button } from "@/components/ui/button";
import ProductShot from "@/components/ProductShot";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import gdvScreenshot from "@/assets/screenshot-gdv-calculator.png";

const Hero = () => {
  const scrollToFeatures = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative overflow-hidden pt-28 sm:pt-36 pb-16 sm:pb-24">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-background to-background" />
      <div className="absolute top-24 right-0 w-96 h-96 bg-success/10 rounded-full blur-3xl" />
      <div className="absolute top-40 left-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-6">
            Built for small and first-time UK developers
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-[1.1] tracking-tight">
            Spreadsheets in. <span className="bg-gradient-hero bg-clip-text text-transparent">Lender-ready feasibility out.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
            Draw a site, get a compliant housing layout and a full GDV appraisal in minutes —
            not a week of Excel and consultant fees.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Button variant="cta" size="lg" className="text-base px-7 py-6 h-auto" asChild>
              <a href="/auth">
                Start My Free Feasibility Check
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" size="lg" className="text-base px-7 py-6 h-auto" onClick={scrollToFeatures}>
              See How It Works
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> No credit card required</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> 5 free projects</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> Set up in 2 minutes</span>
          </div>
        </div>

        <div className="relative mt-14 sm:mt-20 max-w-5xl mx-auto animate-slide-in">
          <ProductShot
            src={gdvScreenshot}
            alt="EazyBuild's GDV calculator showing a live unit mix, cost breakdown and residual land value for a real development scheme"
            className="lg:mx-8"
          />
          <div className="hidden md:flex absolute -bottom-6 -left-6 items-center gap-3 bg-card border rounded-xl shadow-large px-4 py-3">
            <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center text-success text-sm font-bold">
              18%
            </div>
            <div className="text-xs">
              <p className="font-semibold text-foreground">Profit margin</p>
              <p className="text-muted-foreground">Recalculated live</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
