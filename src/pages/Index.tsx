import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import FeatureShowcase from "@/components/FeatureShowcase";
import FounderMessage from "@/components/FounderMessage";
import CtaSection from "@/components/CtaSection";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <FeatureShowcase />
      <FounderMessage />
      <CtaSection />
      <Footer />
    </div>
  );
};

export default Index;
