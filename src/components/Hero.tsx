import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Calculator, Brain, FileText } from "lucide-react";
import heroImage from "@/assets/hero-property.jpg";

const Hero = () => {
  const scrollToGetStarted = () => {
    const element = document.getElementById("get-started");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 sm:pt-20">
      {/* Background with gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left content */}
          <div className="text-center lg:text-left animate-fade-in">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Turn messy spreadsheets into smart, lender-ready feasibility{" "}
              <span className="bg-gradient-hero bg-clip-text text-transparent">in minutes.</span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground mb-8 leading-relaxed">
              For small, medium, and first-time developers who are tired of the chaos of Excel models 
              and consultant fees — our all-in-one app instantly transforms site data into clear, 
              accurate, and professional feasibility reports that lenders and investors trust.
            </p>

            {/* Benefit bullets */}
            <div className="space-y-4 mb-8">
              <BenefitItem 
                icon={<TrendingUp className="w-5 h-5" />}
                text="Instant Viability Checks: Go from site polygon to full appraisal in minutes."
              />
              <BenefitItem 
                icon={<DollarSign className="w-5 h-5" />}
                text="No More Consultant Costs: Built-in cost benchmarks, profit margins, and planning overlays."
              />
              <BenefitItem 
                icon={<Calculator className="w-5 h-5" />}
                text="Confidence in Every Number: Dynamic error-free calculations that update in real time."
              />
              <BenefitItem 
                icon={<Brain className="w-5 h-5" />}
                text="AI-Driven Insights: Suggests optimal housing mixes and risk-adjusted scenarios."
              />
              <BenefitItem 
                icon={<FileText className="w-5 h-5" />}
                text="Lender-Ready Reports: Export clean, professional viability packs instantly."
              />
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button
                variant="cta"
                size="lg"
                className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto"
                onClick={scrollToGetStarted}
              >
                Start My Free Feasibility Check
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mt-4">
              No spreadsheets. No stress. Just clarity.
            </p>
          </div>

          {/* Right image */}
          <div className="relative animate-slide-in hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden shadow-large">
              <img 
                src={heroImage} 
                alt="Modern property development visualization with digital planning tools" 
                className="w-full h-auto"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const BenefitItem = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-start gap-3 text-left">
    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent mt-0.5">
      {icon}
    </div>
    <p className="text-foreground font-medium flex-1">{text}</p>
  </div>
);

export default Hero;
