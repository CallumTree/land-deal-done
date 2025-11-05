import { Mail, Linkedin, Twitter } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[#1B1B1D] border-t border-[#252528] py-12">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            <div className="text-2xl sm:text-3xl font-bold font-['Poppins'] text-[#F5F5F7] mb-4">
              EazyBuild
            </div>
            <p className="text-[#888] mb-4 max-w-md font-['Inter']">
              Simplifying property development feasibility for small, medium, and first-time developers.
            </p>
            <div className="flex gap-4">
              <a 
                href="mailto:hello@eazybuild.com" 
                className="w-10 h-10 rounded-full bg-[#5BC199]/10 hover:bg-[#5BC199]/20 flex items-center justify-center transition-colors text-[#5BC199]"
                aria-label="Email us"
              >
                <Mail className="w-5 h-5" />
              </a>
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-[#5BC199]/10 hover:bg-[#5BC199]/20 flex items-center justify-center transition-colors text-[#5BC199]"
                aria-label="Follow us on LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-[#5BC199]/10 hover:bg-[#5BC199]/20 flex items-center justify-center transition-colors text-[#5BC199]"
                aria-label="Follow us on Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold font-['Poppins'] text-[#F5F5F7] mb-4">Product</h4>
            <ul className="space-y-2 text-[#888] font-['Inter']">
              <li>
                <a href="#features" className="hover:text-[#5BC199] transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-[#5BC199] transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#get-started" className="hover:text-[#5BC199] transition-colors">
                  Get Started
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold font-['Poppins'] text-[#F5F5F7] mb-4">Company</h4>
            <ul className="space-y-2 text-[#888] font-['Inter']">
              <li>
                <a href="#" className="hover:text-[#5BC199] transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#5BC199] transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#5BC199] transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#252528] pt-8 text-center text-[#888] text-sm font-['Inter']">
          <p>&copy; {new Date().getFullYear()} EazyBuild. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
