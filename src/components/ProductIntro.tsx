import { Map, BarChart3, FileCheck } from "lucide-react";

const ProductIntro = () => {
  return (
    <section className="py-16 sm:py-24 bg-secondary/30" id="how-it-works">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-accent/10 text-accent px-4 py-2 rounded-full text-sm font-semibold mb-4">
            🏗️ Introducing EazyBuild
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Feasibility Reimagined
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto">
            EazyBuild replaces traditional spreadsheets with a seamless digital workspace for property 
            development viability. From mapping sites to generating lender-ready packs, it's the simplest, 
            smartest way to know if your project will profit.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <ProcessStep
              number="1"
              icon={<Map className="w-8 h-8" />}
              title="Map It"
              description="Draw or upload your site boundary — EazyBuild automatically measures area and overlays constraints."
            />
            <ProcessStep
              number="2"
              icon={<BarChart3 className="w-8 h-8" />}
              title="Model It"
              description="Choose from default house types or upload your own — see build costs, sales values, and profit margins instantly."
            />
            <ProcessStep
              number="3"
              icon={<FileCheck className="w-8 h-8" />}
              title="Report It"
              description="Generate a lender-ready viability pack in one click — complete with planning notes and market benchmarks."
            />
          </div>
        </div>
      </div>
    </section>
  );
};

const ProcessStep = ({ 
  number, 
  icon, 
  title, 
  description 
}: { 
  number: string; 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) => (
  <div className="relative bg-card rounded-xl p-6 sm:p-8 shadow-soft hover:shadow-medium transition-all animate-fade-in border border-border group">
    <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-hero flex items-center justify-center text-primary-foreground font-bold text-xl shadow-medium">
      {number}
    </div>
    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-4 group-hover:bg-accent/20 transition-colors mt-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-foreground mb-3">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

export default ProductIntro;
