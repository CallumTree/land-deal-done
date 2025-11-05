import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Rocket } from "lucide-react";

const EmailCapture = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Please fill in required fields",
        description: "Name and email are required.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    // Simulate submission (replace with actual API call)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Success! 🎉",
      description: "You're on the waitlist. We'll be in touch soon!",
    });
    
    setName("");
    setEmail("");
    setCompany("");
    setIsSubmitting(false);
  };

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-br from-[#5BC199]/10 to-[#5BC199]/5" id="get-started">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-[#5BC199]/20 text-[#5BC199] px-4 py-2 rounded-full text-sm font-semibold mb-6">
            <Rocket className="w-4 h-4" />
            Limited Beta Access
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-['Poppins'] text-[#F5F5F7] mb-4">
            Start My Free Feasibility Check Now
          </h2>
          
          <p className="text-lg text-[#888] mb-8 font-['Inter']">
            No credit card required. Get clarity in minutes.
          </p>

          <form onSubmit={handleSubmit} className="bg-[#252528] rounded-2xl p-6 sm:p-8 shadow-[0_10px_30px_-10px_rgba(91,193,153,0.3)] border border-[#5BC199]/20">
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <Input
                type="text"
                placeholder="Your Name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12"
              />
              <Input
                type="email"
                placeholder="Your Email *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>
            
            <Input
              type="text"
              placeholder="Company (Optional)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="mb-6 h-12"
            />

            <Button
              type="submit"
              variant="cta"
              size="lg"
              className="w-full text-lg py-6 h-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Joining..." : "Get Early Access"}
            </Button>

            <p className="text-sm text-[#888] mt-4 font-['Inter']">
              Join hundreds of developers already simplifying their feasibility process.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};

export default EmailCapture;
