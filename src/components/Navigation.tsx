import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-background/95 backdrop-blur-sm shadow-soft" : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <div className="flex items-center space-x-2">
            <div className="text-2xl sm:text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              EazyBuild
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="ghost"
              className="hidden sm:inline-flex"
              onClick={() => scrollToSection("features")}
            >
              Features
            </Button>
            <Button
              variant="ghost"
              className="hidden sm:inline-flex"
              onClick={() => scrollToSection("how-it-works")}
            >
              How It Works
            </Button>
            <Button
              variant="cta"
              size="lg"
              onClick={() => scrollToSection("get-started")}
            >
              Try Free
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
