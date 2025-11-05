import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MapPin,
  TrendingUp,
  FileText,
  BarChart3,
  Zap,
  Target,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import heroImage from "@/assets/hero-property.jpg";

const RegisterInterest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    companyType: "",
    region: "",
    betaAccess: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const scrollToForm = () => {
    document.getElementById("register-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      toast({
        title: "Missing information",
        description: "Please provide your name and email.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("early_interest").insert({
        name: formData.name,
        email: formData.email,
        company_type: formData.companyType || null,
        region: formData.region || null,
        beta_access: formData.betaAccess,
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: "Welcome to BuildFlow!",
        description: "We'll notify you when your region is ready.",
      });

      // Track analytics event
      if (typeof (window as any).gtag === "function") {
        (window as any).gtag("event", "register_interest_submitted", {
          company_type: formData.companyType,
          region: formData.region,
          beta_access: formData.betaAccess,
        });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Submission failed",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1B1B1D] text-[#F5F5F7]">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B1B1D] via-[#252528] to-[#1B1B1D] opacity-95" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Content */}
            <div className="space-y-8 text-center lg:text-left">
              <div className="inline-block px-4 py-1.5 bg-[#5BC199]/10 border border-[#5BC199]/20 rounded-full">
                <span className="text-[#5BC199] text-sm font-medium">Early Access Available</span>
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-['Poppins'] leading-tight">
                Smarter Feasibility for UK Developers.
              </h1>
              
              <p className="text-xl sm:text-2xl text-[#888] font-['Inter']">
                Map. Model. Value. All in one platform.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  onClick={scrollToForm}
                  size="lg"
                  className="bg-[#5BC199] hover:bg-[#4BA080] text-[#1B1B1D] font-semibold px-8 py-6 text-lg rounded-lg shadow-lg shadow-[#5BC199]/20 transition-all hover:shadow-xl hover:shadow-[#5BC199]/30"
                >
                  Join Early Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  onClick={scrollToForm}
                  variant="outline"
                  size="lg"
                  className="border-[#5BC199]/30 text-[#5BC199] hover:bg-[#5BC199]/10 px-8 py-6 text-lg rounded-lg"
                >
                  Learn More
                  <ChevronDown className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Right: Screenshot */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-[#5BC199]/20 to-[#5BC199]/5 rounded-3xl blur-2xl" />
              <img
                src={heroImage}
                alt="BuildFlow Platform Screenshot"
                className="relative rounded-2xl shadow-2xl border border-[#5BC199]/10 w-full hover:scale-[1.02] transition-transform duration-500"
              />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-6 w-6 text-[#888]" />
        </div>
      </section>

      {/* Pain Points → Solution Section */}
      <section className="py-20 lg:py-32 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-['Poppins'] mb-4">
              Stop Struggling with Spreadsheets
            </h2>
            <p className="text-lg text-[#888] max-w-2xl mx-auto">
              BuildFlow transforms how developers assess site viability
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Before */}
            <Card className="bg-[#252528]/50 border-[#333]/50 backdrop-blur-sm">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Target className="h-6 w-6 text-red-400" />
                  </div>
                  <h3 className="text-2xl font-bold font-['Poppins']">Before BuildFlow</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-red-400/50 flex-shrink-0" />
                    <p className="text-[#888]">Disjointed spreadsheets across multiple files</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-red-400/50 flex-shrink-0" />
                    <p className="text-[#888]">No consistent build cost data</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-red-400/50 flex-shrink-0" />
                    <p className="text-[#888]">Lender rejections over missing feasibility detail</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="mt-1.5 w-2 h-2 rounded-full bg-red-400/50 flex-shrink-0" />
                    <p className="text-[#888]">Hours spent formatting reports manually</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* After */}
            <Card className="bg-gradient-to-br from-[#5BC199]/10 to-[#5BC199]/5 border-[#5BC199]/30 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#5BC199]/20 rounded-full blur-3xl" />
              <CardContent className="p-8 space-y-6 relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#5BC199]/20 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-[#5BC199]" />
                  </div>
                  <h3 className="text-2xl font-bold font-['Poppins']">After BuildFlow</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#5BC199] flex-shrink-0" />
                    <p className="text-[#F5F5F7]">Draw sites and calculate GDVs instantly</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#5BC199] flex-shrink-0" />
                    <p className="text-[#F5F5F7]">Live regional cost & sales data</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#5BC199] flex-shrink-0" />
                    <p className="text-[#F5F5F7]">Export lender-ready summaries in seconds</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#5BC199] flex-shrink-0" />
                    <p className="text-[#F5F5F7]">Professional reports with one click</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-20 lg:py-32 bg-[#252528]/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-['Poppins'] mb-4">
              Everything You Need in One Platform
            </h2>
            <p className="text-lg text-[#888] max-w-2xl mx-auto">
              Purpose-built for UK property professionals
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Zap className="h-7 w-7" />,
                title: "AI-backed Feasibility",
                description: "Automatically generate site viability from drawn polygons.",
              },
              {
                icon: <FileText className="h-7 w-7" />,
                title: "Lender Pack Export",
                description: "Create investor-ready reports with one click.",
              },
              {
                icon: <TrendingUp className="h-7 w-7" />,
                title: "Planning Uplift Insight",
                description: "Instantly see the value created by planning consent.",
              },
              {
                icon: <BarChart3 className="h-7 w-7" />,
                title: "Regional Data Indexing",
                description: "Build and sales values tied to live market data.",
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="bg-[#252528]/50 border-[#5BC199]/20 hover:border-[#5BC199]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#5BC199]/10 group"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-14 h-14 rounded-xl bg-[#5BC199]/10 flex items-center justify-center text-[#5BC199] group-hover:bg-[#5BC199]/20 transition-colors">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold font-['Poppins']">{feature.title}</h3>
                  <p className="text-[#888] text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="py-20 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-['Poppins'] mb-4">
              Built to Scale with You
            </h2>
            <p className="text-lg text-[#888] max-w-2xl mx-auto">
              Start simple. Grow with BuildFlow as your projects and team scale.
            </p>
          </div>

          <div className="space-y-6 max-w-4xl mx-auto">
            {[
              {
                phase: "MVP (Now)",
                status: "Live",
                features: ["Feasibility Calculator", "GDV Calculator", "Lender Pack Export"],
                color: "bg-[#5BC199]",
              },
              {
                phase: "v1.1 (Soon)",
                status: "In Progress",
                features: ["Regional cost indexing", "Planning data integration", "Enhanced analytics"],
                color: "bg-blue-500",
              },
              {
                phase: "v1.2 (Q2 2025)",
                status: "Planned",
                features: ["AI Assistant for feasibility Q&A", "Document intelligence", "Automated comparables"],
                color: "bg-purple-500",
              },
              {
                phase: "v1.3 (Q3 2025)",
                status: "Planned",
                features: ["Team dashboards", "Project sharing", "Multi-user collaboration"],
                color: "bg-orange-500",
              },
            ].map((item, index) => (
              <Card
                key={index}
                className="bg-[#252528]/50 border-[#333]/50 hover:border-[#5BC199]/30 transition-all duration-300"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full ${item.color} flex items-center justify-center`}>
                        <Calendar className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold font-['Poppins']">{item.phase}</h3>
                        <span className="text-sm text-[#888]">{item.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 ml-14">
                    {item.features.map((feature, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-[#1B1B1D] border border-[#333] rounded-full text-sm text-[#888]"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Visual Gallery */}
      <section className="py-20 lg:py-32 bg-[#252528]/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-['Poppins'] mb-4">
              See BuildFlow in Action
            </h2>
            <p className="text-lg text-[#888]">
              Real screenshots from the platform
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Site Map & Polygon Drawing",
                description: "Draw boundaries, calculate areas, and visualize site potential",
              },
              {
                title: "GDV Calculator",
                description: "Live calculations with regional cost data and market insights",
              },
              {
                title: "Lender Summary Pack",
                description: "Professional reports ready for investor presentations",
              },
            ].map((item, index) => (
              <div key={index} className="group space-y-4">
                <div className="relative overflow-hidden rounded-xl border border-[#5BC199]/20 hover:border-[#5BC199]/50 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#5BC199]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <img
                    src={heroImage}
                    alt={item.title}
                    className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold font-['Poppins']">{item.title}</h3>
                  <p className="text-sm text-[#888]">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section id="register-form" className="py-20 lg:py-32">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold font-['Poppins'] mb-4">
              Register for Early Access
            </h2>
            <p className="text-lg text-[#888]">
              Join the waitlist to access BuildFlow before public launch and receive exclusive launch pricing.
            </p>
          </div>

          {isSubmitted ? (
            <Card className="bg-gradient-to-br from-[#5BC199]/10 to-[#5BC199]/5 border-[#5BC199]/30">
              <CardContent className="p-12 text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#5BC199]/20 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-[#5BC199]" />
                </div>
                <h3 className="text-2xl font-bold font-['Poppins']">Thanks for joining!</h3>
                <p className="text-[#888]">
                  We'll notify you when your region is ready. Check your email for next steps.
                </p>
                <Button
                  onClick={() => navigate("/")}
                  variant="outline"
                  className="border-[#5BC199]/30 text-[#5BC199] hover:bg-[#5BC199]/10"
                >
                  Return Home
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[#252528]/50 border-[#333]/50 backdrop-blur-sm">
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-[#F5F5F7]">
                      Name *
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-[#1B1B1D] border-[#333] focus:border-[#5BC199] text-[#F5F5F7]"
                      placeholder="Your full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[#F5F5F7]">
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="bg-[#1B1B1D] border-[#333] focus:border-[#5BC199] text-[#F5F5F7]"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyType" className="text-[#F5F5F7]">
                      Company / Role
                    </Label>
                    <Select
                      value={formData.companyType}
                      onValueChange={(value) => setFormData({ ...formData, companyType: value })}
                    >
                      <SelectTrigger className="bg-[#1B1B1D] border-[#333] text-[#F5F5F7]">
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="developer">Developer</SelectItem>
                        <SelectItem value="contractor">Contractor</SelectItem>
                        <SelectItem value="qs">Quantity Surveyor</SelectItem>
                        <SelectItem value="investor">Investor</SelectItem>
                        <SelectItem value="land_sourcer">Land Sourcer</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="region" className="text-[#F5F5F7]">
                      Region of Interest
                    </Label>
                    <Select
                      value={formData.region}
                      onValueChange={(value) => setFormData({ ...formData, region: value })}
                    >
                      <SelectTrigger className="bg-[#1B1B1D] border-[#333] text-[#F5F5F7]">
                        <SelectValue placeholder="Select your region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="london">London</SelectItem>
                        <SelectItem value="south_east">South East</SelectItem>
                        <SelectItem value="south_west">South West</SelectItem>
                        <SelectItem value="midlands">Midlands</SelectItem>
                        <SelectItem value="north">North</SelectItem>
                        <SelectItem value="scotland">Scotland</SelectItem>
                        <SelectItem value="wales">Wales</SelectItem>
                        <SelectItem value="northern_ireland">Northern Ireland</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="betaAccess"
                      checked={formData.betaAccess}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, betaAccess: checked as boolean })
                      }
                    />
                    <Label
                      htmlFor="betaAccess"
                      className="text-sm text-[#888] cursor-pointer"
                    >
                      I'm interested in early beta access
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#5BC199] hover:bg-[#4BA080] text-[#1B1B1D] font-semibold py-6 text-lg rounded-lg shadow-lg shadow-[#5BC199]/20 hover:shadow-xl hover:shadow-[#5BC199]/30 transition-all"
                  >
                    {isSubmitting ? "Submitting..." : "Join Early Access"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Closing Section */}
      <section className="py-20 bg-gradient-to-b from-[#1B1B1D] to-[#252528]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl font-bold font-['Poppins']">
            Join hundreds of developers, contractors, and land sourcers preparing for smarter feasibility.
          </h2>
          <Button
            onClick={scrollToForm}
            size="lg"
            className="bg-[#5BC199] hover:bg-[#4BA080] text-[#1B1B1D] font-semibold px-8 py-6 text-lg rounded-lg shadow-lg shadow-[#5BC199]/20 hover:shadow-xl hover:shadow-[#5BC199]/30"
          >
            Join the Waitlist
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#333]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[#888] text-sm">
            <p>BuildFlow © 2025 — Data-driven feasibility tools for UK property professionals.</p>
            <div className="flex gap-6">
              <button onClick={() => navigate("/")} className="hover:text-[#5BC199] transition-colors">
                Home
              </button>
              <button onClick={scrollToForm} className="hover:text-[#5BC199] transition-colors">
                Register
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default RegisterInterest;
