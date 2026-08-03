import { TrendingUp, DollarSign, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

const DesiredOutcome = () => {
  const scrollToGetStarted = () => {
    const element = document.getElementById("get-started");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="py-16 sm:py-24 bg-slate-900" id="features">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 animate-fade-in">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            Imagine knowing instantly if a site is{" "}
            <span className="text-success">worth your time.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <OutcomeCard
            icon={<TrendingUp className="w-7 h-7" />}
            title="Fast, Confident Decisions"
            description="Within minutes, see your projected profit, GDV, and residual land value — with full transparency behind the numbers."
          />
          <OutcomeCard
            icon={<DollarSign className="w-7 h-7" />}
            title="Lower Costs, Higher Margins"
            description="No more paying consultants for what the app can automate; your budget goes into your build, not your overhead."
          />
          <OutcomeCard
            icon={<Navigation className="w-7 h-7" />}
            title="Stress-Free Clarity"
            description="From planning overlays to lender reports, you'll finally feel in control of every step — no more guesswork or waiting weeks for answers."
          />
        </div>

        <div className="max-w-3xl mx-auto text-center bg-white/[0.04] rounded-2xl p-6 sm:p-8 animate-fade-in border border-white/10">
          <p className="text-lg sm:text-xl font-semibold text-white mb-6">
            Forget spreadsheets. Forget hours lost to data entry. Welcome to feasibility in one flow —
            where AI, data, and design finally work together to make development simple.
          </p>
          <Button
            variant="cta"
            size="lg"
            onClick={scrollToGetStarted}
          >
            Get Early Access — Free While in Beta
          </Button>
        </div>
      </div>
    </section>
  );
};

const OutcomeCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="bg-white/[0.04] rounded-xl p-6 sm:p-8 transition-all animate-fade-in border border-white/10 group hover:border-success/40 hover:bg-white/[0.06]">
    <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center text-success mb-4 group-hover:bg-success/25 transition-colors">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-slate-400 leading-relaxed">{description}</p>
  </div>
);

export default DesiredOutcome;
