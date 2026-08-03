import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    password: "",
    companyType: "",
    region: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const scrollToForm = () => {
    document.getElementById("register-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.password) {
      toast({
        title: "Missing information",
        description: "Please provide your name, email, and password.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: formData.name,
            company_name: formData.companyType,
          }
        }
      });

      if (authError) throw authError;

      // Update profile with additional data
      if (authData.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            role: formData.companyType || null,
            region: formData.region || null,
          })
          .eq("id", authData.user.id);

        if (profileError) console.error("Profile update error:", profileError);
      }

      // Also save to early_interest table for tracking
      await supabase.from("early_interest").insert({
        name: formData.name,
        email: formData.email,
        company_type: formData.companyType || null,
        region: formData.region || null,
        beta_access: true,
      });

      toast({
        title: "Account created!",
        description: "Redirecting to your dashboard...",
      });

      // Track analytics event
      if (typeof (window as any).gtag === "function") {
        (window as any).gtag("event", "signup_completed", {
          company_type: formData.companyType,
          region: formData.region,
        });
      }

      // Redirect to dashboard
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);

    } catch (error: any) {
      console.error("Error creating account:", error);
      toast({
        title: "Registration failed",
        description: error.message || "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-success/5" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-success/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Content */}
            <div className="space-y-8 text-center lg:text-left">
              <div className="inline-block px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
                <span className="text-primary text-sm font-medium">Early Access Available</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-foreground">
                Smarter Feasibility for UK Developers.
              </h1>

              <p className="text-xl sm:text-2xl text-muted-foreground">
                Map. Model. Value. All in one platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button onClick={scrollToForm} variant="cta" size="lg" className="text-lg px-8 py-6 h-auto">
                  Join Early Access
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button onClick={scrollToForm} variant="outline" size="lg" className="text-lg px-8 py-6 h-auto">
                  Learn More
                  <ChevronDown className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Right: Screenshot */}
            <div className="relative hidden lg:block">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/10 to-success/5 rounded-3xl blur-2xl" />
              <img
                src={heroImage}
                alt="BuildFlow Platform Screenshot"
                className="relative rounded-2xl shadow-large border w-full hover:scale-[1.02] transition-transform duration-500"
              />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-6 w-6 text-muted-foreground" />
        </div>
      </section>

      {/* Pain Points → Solution Section */}
      <section className="py-20 lg:py-32 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Stop Struggling with Spreadsheets
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              BuildFlow transforms how developers assess site viability
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
            {/* Before */}
            <Card>
              <CardContent className="p-8 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Target className="h-6 w-6 text-destructive" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Before BuildFlow</h3>
                </div>

                <div className="space-y-4">
                  {[
                    "Disjointed spreadsheets across multiple files",
                    "No consistent build cost data",
                    "Lender rejections over missing feasibility detail",
                    "Hours spent formatting reports manually",
                  ].map((point) => (
                    <div className="flex gap-3" key={point}>
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-destructive/50 flex-shrink-0" />
                      <p className="text-muted-foreground">{point}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* After */}
            <Card className="bg-gradient-to-br from-primary/[0.06] to-success/[0.06] border-primary/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <CardContent className="p-8 space-y-6 relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">After BuildFlow</h3>
                </div>

                <div className="space-y-4">
                  {[
                    "Draw sites and calculate GDVs instantly",
                    "Live regional cost & sales data",
                    "Export lender-ready summaries in seconds",
                    "Professional reports with one click",
                  ].map((point) => (
                    <div className="flex gap-3" key={point}>
                      <CheckCircle2 className="mt-0.5 h-5 w-5 text-success flex-shrink-0" />
                      <p className="text-foreground">{point}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-20 lg:py-32 bg-muted/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Everything You Need in One Platform
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Purpose-built for UK property professionals
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <Zap className="h-6 w-6" />,
                title: "AI-backed Feasibility",
                description: "Automatically generate site viability from drawn polygons.",
              },
              {
                icon: <FileText className="h-6 w-6" />,
                title: "Lender Pack Export",
                description: "Create investor-ready reports with one click.",
              },
              {
                icon: <TrendingUp className="h-6 w-6" />,
                title: "Planning Uplift Insight",
                description: "Instantly see the value created by planning consent.",
              },
              {
                icon: <BarChart3 className="h-6 w-6" />,
                title: "Regional Data Indexing",
                description: "Build and sales values tied to live market data.",
              },
            ].map((feature) => (
              <Card
                key={feature.title}
                className="hover:border-primary/30 hover:shadow-medium transition-all duration-300 group"
              >
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/15 transition-colors">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
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
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Built to Scale with You
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start simple. Grow with BuildFlow as your projects and team scale.
            </p>
          </div>

          <div className="space-y-6 max-w-4xl mx-auto">
            {[
              {
                phase: "MVP (Now)",
                status: "Live",
                features: ["Feasibility Calculator", "GDV Calculator", "Lender Pack Export"],
                color: "bg-primary",
              },
              {
                phase: "v1.1 (Soon)",
                status: "In Progress",
                features: ["Regional cost indexing", "Planning data integration", "Enhanced analytics"],
                color: "bg-info",
              },
              {
                phase: "v1.2 (Q2 2025)",
                status: "Planned",
                features: ["AI Assistant for feasibility Q&A", "Document intelligence", "Automated comparables"],
                color: "bg-[hsl(262_83%_58%)]",
              },
              {
                phase: "v1.3 (Q3 2025)",
                status: "Planned",
                features: ["Team dashboards", "Project sharing", "Multi-user collaboration"],
                color: "bg-warning",
              },
            ].map((item) => (
              <Card key={item.phase} className="hover:border-primary/30 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full ${item.color} flex items-center justify-center`}>
                        <Calendar className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{item.phase}</h3>
                        <span className="text-sm text-muted-foreground">{item.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:ml-14">
                    {item.features.map((feature) => (
                      <span
                        key={feature}
                        className="px-3 py-1 bg-muted border rounded-full text-sm text-muted-foreground"
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
      <section className="py-20 lg:py-32 bg-muted/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              See BuildFlow in Action
            </h2>
            <p className="text-lg text-muted-foreground">
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
            ].map((item) => (
              <div key={item.title} className="group space-y-4">
                <div className="relative overflow-hidden rounded-xl border hover:border-primary/40 transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <img
                    src={heroImage}
                    alt={item.title}
                    className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
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
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">
              Get Instant Access
            </h2>
            <p className="text-lg text-muted-foreground">
              Create your free account and start running feasibility checks immediately.
            </p>
          </div>

          {isSubmitted ? (
            <Card className="bg-gradient-to-br from-primary/[0.06] to-success/[0.06] border-primary/20">
              <CardContent className="p-12 text-center space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-success/15 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Account Created!</h3>
                <p className="text-muted-foreground">
                  Redirecting you to your dashboard...
                </p>
                <Button onClick={() => navigate("/")} variant="outline">
                  Return Home
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Your full name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Minimum 6 characters"
                      minLength={6}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyType">Company / Role</Label>
                    <Select
                      value={formData.companyType}
                      onValueChange={(value) => setFormData({ ...formData, companyType: value })}
                    >
                      <SelectTrigger id="companyType">
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
                    <Label htmlFor="region">Region of Interest</Label>
                    <Select
                      value={formData.region}
                      onValueChange={(value) => setFormData({ ...formData, region: value })}
                    >
                      <SelectTrigger id="region">
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

                  <Button type="submit" variant="cta" disabled={isSubmitting} className="w-full py-6 h-auto text-lg">
                    {isSubmitting ? "Creating Account..." : "Create Free Account"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Closing Section */}
      <section className="py-20 bg-slate-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Join hundreds of developers, contractors, and land sourcers preparing for smarter feasibility.
          </h2>
          <Button onClick={scrollToForm} variant="cta" size="lg" className="text-lg px-8 py-6 h-auto">
            Get Started Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-muted-foreground text-sm">
            <p>BuildFlow © 2025 — Data-driven feasibility tools for UK property professionals.</p>
            <div className="flex gap-6">
              <button onClick={() => navigate("/")} className="hover:text-primary transition-colors">
                Home
              </button>
              <button onClick={scrollToForm} className="hover:text-primary transition-colors">
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
