import { FileSpreadsheet, DollarSign, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const PainPoints = () => {
  const scrollToHowItWorks = () => {
    const element = document.getElementById("how-it-works");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="py-16 sm:py-24 bg-muted/40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16 animate-fade-in">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Still buried in spreadsheets and uncertainty?
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <PainCard
            icon={<FileSpreadsheet className="w-7 h-7" />}
            title="Spreadsheet Chaos"
            description="You've got ten tabs open, three versions of the same Excel sheet, and every change breaks a formula. Each site appraisal feels like starting over."
          />
          <PainCard
            icon={<DollarSign className="w-7 h-7" />}
            title="Consultant Costs"
            description="You've spent thousands on consultants just to validate basic numbers — and even then, lenders ask for it in a different format."
          />
          <PainCard
            icon={<Clock className="w-7 h-7" />}
            title="Missed Opportunities"
            description="You know a deal might be great, but you can't run the numbers fast enough to be sure — so you miss opportunities to act first."
          />
        </div>

        <div className="max-w-3xl mx-auto text-center bg-card border rounded-2xl p-6 sm:p-8 shadow-medium animate-fade-in">
          <p className="text-lg text-muted-foreground mb-6">
            Everyone tells you "just use Excel" or "hire a QS," but that's not realistic for small developers.
            You don't need more spreadsheets — you need <span className="font-semibold text-foreground">clarity, automation, and speed</span>.
          </p>
          <Button
            variant="ctaOutline"
            size="lg"
            onClick={scrollToHowItWorks}
          >
            See How It Works
          </Button>
        </div>
      </div>
    </section>
  );
};

const PainCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="bg-card border rounded-xl p-6 sm:p-8 shadow-soft hover:shadow-medium hover:border-primary/30 transition-all animate-fade-in">
    <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-foreground mb-3">{title}</h3>
    <p className="text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

export default PainPoints;
