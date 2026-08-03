import { Map, BarChart3, FileCheck, Zap } from "lucide-react";
import ProductShot from "@/components/ProductShot";
import layoutScreenshot from "@/assets/screenshot-smart-layout.png";
import gdvScreenshot from "@/assets/screenshot-gdv-calculator.png";
import lenderScreenshot from "@/assets/screenshot-lender-export.png";

const FeatureShowcase = () => {
  return (
    <section className="py-16 sm:py-24" id="how-it-works">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 animate-fade-in" id="features">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            Introducing EazyBuild
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Everything a spreadsheet can't do
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Draw it, model it, report it — one workspace that replaces the tabs, the consultant,
            and the guesswork.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-6xl mx-auto items-start">
          <FeatureTile
            icon={<Map className="w-6 h-6" />}
            eyebrow="1. Map it"
            title="A compliant layout in seconds, not a week with a planning consultant"
            description="Draw your site boundary and EazyBuild finds the real road frontage, generates a rule-based housing layout with gardens and access, and checks it against UK planning guidance."
          >
            <ProductShot
              src={layoutScreenshot}
              alt="Smart-generated site layout showing plots, gardens and an access road connected to a real street"
              className="mt-6 bg-slate-950"
              imgClassName="w-full h-auto max-h-72 object-contain"
              focus="center"
            />
          </FeatureTile>

          <FeatureTile
            icon={<BarChart3 className="w-6 h-6" />}
            eyebrow="2. Model it"
            title="Live GDV, cost and margin — recalculated on every edit"
            description="Swap the unit mix and watch build cost, sales value and residual land value update instantly."
          >
            <ProductShot
              src={gdvScreenshot}
              alt="GDV calculator with a unit mix table and live profit summary"
              className="mt-6"
              imgClassName="max-h-72 object-cover"
            />
          </FeatureTile>

          <FeatureTile
            icon={<FileCheck className="w-6 h-6" />}
            eyebrow="3. Report it"
            title="A lender-ready pack in one click"
            description="Key metrics, cost breakdown and site overview, formatted for the people who actually approve the deal."
            className="md:col-span-2"
          >
            <ProductShot
              src={lenderScreenshot}
              alt="Lender export summary with key metrics, site overview and cost breakdown"
              className="mt-6 md:max-w-2xl md:mx-auto"
              imgClassName="max-h-80 object-cover"
            />
          </FeatureTile>
        </div>

        <div className="max-w-6xl mx-auto mt-5">
          <div className="flex items-center gap-4 bg-card border rounded-2xl p-6 sm:p-8 shadow-soft">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center text-success flex-shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">No consultant retainer, no version-control nightmare. </span>
              Everything above runs off one set of numbers you enter once.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const FeatureTile = ({
  icon,
  eyebrow,
  title,
  description,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-card border rounded-2xl p-6 sm:p-8 shadow-soft hover:shadow-medium hover:border-primary/30 transition-all animate-fade-in flex flex-col ${className}`}
  >
    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
      {icon}
    </div>
    <span className="text-sm font-semibold text-primary mb-1">{eyebrow}</span>
    <h3 className="text-xl font-bold text-foreground mb-3">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">{description}</p>
    {children}
  </div>
);

export default FeatureShowcase;
