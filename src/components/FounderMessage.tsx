const FounderMessage = () => {
  return (
    <section className="py-16 sm:py-24 bg-[#1B1B1D]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-[#5BC199]/5 to-[#5BC199]/10 rounded-2xl p-8 sm:p-12 shadow-[0_10px_30px_-10px_rgba(91,193,153,0.3)] border border-[#5BC199]/20 animate-fade-in">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#5BC199] to-[#5BC199]/80 flex items-center justify-center text-white text-2xl font-bold shadow-[0_4px_12px_rgba(91,193,153,0.4)]">
                  CT
                </div>
              </div>
              
              <div className="flex-1">
                <div className="mb-4">
                  <h3 className="text-2xl sm:text-3xl font-bold font-['Poppins'] text-[#F5F5F7] mb-2">
                    A Message from the Founder
                  </h3>
                  <div className="flex items-center gap-2 text-[#888] font-['Inter']">
                    <span className="font-semibold text-[#F5F5F7]">Callum Tree</span>
                    <span>•</span>
                    <span>Founder & Developer</span>
                  </div>
                </div>
                
                <blockquote className="text-lg text-[#888] leading-relaxed border-l-4 border-[#5BC199] pl-4 font-['Inter']">
                  "I built this because I've lived it — juggling spreadsheets, consultants, and endless rework. 
                  EazyBuild was born to give small developers the same power and clarity as the big firms — 
                  without the complexity or cost."
                </blockquote>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FounderMessage;
