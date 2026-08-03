const FounderMessage = () => {
  return (
    <section className="py-16 sm:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-2xl p-8 sm:p-12 shadow-medium border animate-fade-in">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-display font-bold">
                  CT
                </div>
              </div>

              <div className="flex-1">
                <div className="mb-4">
                  <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                    A Message from the Founder
                  </h3>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-semibold text-foreground">Callum Tree</span>
                    <span>•</span>
                    <span>Founder &amp; Developer</span>
                  </div>
                </div>

                <blockquote className="text-lg text-muted-foreground leading-relaxed border-l-4 border-primary pl-4">
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
