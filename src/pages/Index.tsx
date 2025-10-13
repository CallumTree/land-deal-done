import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import PainPoints from "@/components/PainPoints";
import DesiredOutcome from "@/components/DesiredOutcome";
import ProductIntro from "@/components/ProductIntro";
import FounderMessage from "@/components/FounderMessage";
import EmailCapture from "@/components/EmailCapture";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      <PainPoints />
      <DesiredOutcome />
      <ProductIntro />
      <FounderMessage />
      <EmailCapture />
      <Footer />
    </div>
  );
};

export default Index;
