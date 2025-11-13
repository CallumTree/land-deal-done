import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import GlobalHeader from "@/components/GlobalHeader";

export default function Pricing() {
  const navigate = useNavigate();

  const tiers = [
    {
      name: "Free",
      price: "£0",
      period: "forever",
      description: "Perfect for getting started",
      projects: "5 projects",
      features: [
        "AI Quantity Surveyor",
        "Location presets",
        "ROI visualizer",
        "Community support",
        "Watermarked exports"
      ],
      cta: "Get Started",
      variant: "outline" as const,
      popular: false
    },
    {
      name: "Pro",
      price: "£29",
      period: "per month",
      description: "For serious developers",
      projects: "10 projects",
      features: [
        "Everything in Free",
        "PDF exports",
        "No watermarks",
        "Priority support",
        "Advanced analytics"
      ],
      cta: "Upgrade to Pro",
      variant: "default" as const,
      popular: true
    },
    {
      name: "Business",
      price: "£99",
      period: "per month",
      description: "For growing teams",
      projects: "Unlimited projects",
      features: [
        "Everything in Pro",
        "Brandable exports",
        "Planning uplift insights",
        "Team collaboration",
        "Dedicated support"
      ],
      cta: "Upgrade to Business",
      variant: "outline" as const,
      popular: false
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "contact sales",
      description: "For large organizations",
      projects: "Unlimited projects",
      features: [
        "Everything in Business",
        "API access",
        "Custom integrations",
        "SLA guarantee",
        "White-label options"
      ],
      cta: "Contact Sales",
      variant: "outline" as const,
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <GlobalHeader />
      
      <main className="container mx-auto px-4 py-12">
        {/* Promo Banner */}
        <Card className="mb-12 border-primary bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-3">
              <Sparkles className="h-6 w-6 text-primary" />
              <div className="text-center">
                <p className="text-lg font-semibold">Early Adopter Offer</p>
                <p className="text-sm text-muted-foreground">
                  Use code <Badge variant="secondary" className="mx-1">EARLY50</Badge> for 50% off your first year
                </p>
              </div>
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Select the perfect plan for your property development needs
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {tiers.map((tier) => (
            <Card 
              key={tier.name}
              className={`relative flex flex-col ${
                tier.popular ? 'border-primary shadow-lg scale-105' : ''
              }`}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-muted-foreground ml-2">/ {tier.period}</span>
                </div>
                <p className="text-sm font-medium text-primary mt-2">{tier.projects}</p>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button 
                  variant={tier.variant}
                  className="w-full"
                  onClick={() => navigate('/auth')}
                >
                  {tier.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I change plans later?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">How does the EARLY50 promo code work?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Apply code EARLY50 at checkout to receive 50% off your first year on any paid plan.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What happens when I reach my project limit?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  You'll be prompted to upgrade to a higher tier or archive existing projects to create new ones.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
