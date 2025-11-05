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
    <section className="py-16 sm:py-24 bg-[#1B1B1D]" id="features">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 animate-fade-in">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-['Poppins'] text-[#F5F5F7] mb-4">
            Imagine knowing instantly if a site is{" "}
            <span className="text-[#5BC199]">worth your time.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <OutcomeCard
            icon={<TrendingUp className="w-8 h-8" />}
            title="Fast, Confident Decisions"
            description="Within minutes, see your projected profit, GDV, and residual land value — with full transparency behind the numbers."
          />
          <OutcomeCard
            icon={<DollarSign className="w-8 h-8" />}
            title="Lower Costs, Higher Margins"
            description="No more paying consultants for what the app can automate; your budget goes into your build, not your overhead."
          />
          <OutcomeCard
            icon={<Navigation className="w-8 h-8" />}
            title="Stress-Free Clarity"
            description="From planning overlays to lender reports, you'll finally feel in control of every step — no more guesswork or waiting weeks for answers."
          />
        </div>

        <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-[#5BC199]/10 to-[#5BC199]/5 rounded-2xl p-6 sm:p-8 shadow-[0_10px_30px_-10px_rgba(91,193,153,0.3)] animate-fade-in border border-[#5BC199]/20">
          <p className="text-lg sm:text-xl font-semibold font-['Inter'] text-[#F5F5F7] mb-6">
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
  <div className="bg-[#252528]/50 rounded-xl p-6 sm:p-8 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.3)] hover:shadow-[0_10px_30px_-10px_rgba(91,193,153,0.3)] transition-all animate-fade-in border border-border group hover:border-[#5BC199]/50">
    <div className="w-12 h-12 rounded-xl bg-[#5BC199]/10 flex items-center justify-center text-[#5BC199] mb-4 group-hover:bg-[#5BC199]/20 transition-colors">
      {icon}
    </div>
    <h3 className="text-xl font-bold font-['Poppins'] text-[#F5F5F7] mb-3">{title}</h3>
    <p className="text-[#888] leading-relaxed font-['Inter']">{description}</p>
  </div>
);

export default DesiredOutcome;
