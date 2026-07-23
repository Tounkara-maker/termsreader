import { Link } from "react-router-dom";
import { Shield, BookOpen, Clock, Sidebar, CheckCircle2, Chrome, Cpu, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 text-center bg-white border-b border-slate-100">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6 font-sans">
            Don't just accept.<br/>
            <span className="text-blue-600 font-mono italic">Read</span> everything.
          </h1>
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Termsreader uses AI to analyze privacy policies and terms of service in seconds. 
            Get a clear summary directly in your browser sidebar.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/auth" 
              className="px-8 py-4 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl"
            >
              Get Started for Free
            </Link>
            <Link 
              to="/pricing" 
              className="px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-full font-medium hover:bg-slate-50 transition-all"
            >
              View Pricing
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-slate-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12">
            <FeatureCard 
              icon={<Sidebar className="w-8 h-8 text-blue-500" />}
              title="Chrome Sidebar"
              description="Analyze terms without leaving the page. Visible summaries appear right on your screen."
            />
            <FeatureCard 
              icon={<Shield className="w-8 h-8 text-indigo-500" />}
              title="Identity Integrity"
              description="Know exactly which terms you're agreeing to and which ones violate your personal policy."
            />
            <FeatureCard 
              icon={<Clock className="w-8 h-8 text-emerald-500" />}
              title="Delta Detection"
              description="Automatically detects if a website's terms have changed since your last visit."
            />
          </div>
        </div>
      </section>

      {/* How it Works - Redesigned */}
      <section className="py-24 bg-white border-t border-slate-100 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">How Termsreader Protects You</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">Three simple steps to secure your digital footprint and regain control over your data.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection Lines (Desktop Only) */}
            <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-slate-100 -translate-y-1/2 -z-10" />
            
            <Step 
              num="01" 
              icon={<CheckCircle2 className="w-6 h-6" />}
              title="Choose Your Preferences" 
              desc="Select common legal elements you accept and those you explicitly reject in your personal dashboard." 
            />
            <Step 
              num="02" 
              icon={<Chrome className="w-6 h-6" />}
              title="Install the Extension" 
              desc="Add Termsreader to Chrome. It stays active in the background, ready whenever you encounter a terms page." 
            />
            <Step 
              num="03" 
              icon={<Cpu className="w-6 h-6" />}
              title="Get AI Analysis" 
              desc="Gemini AI scans the document in real-time, comparing it with your rules to highlight risks instantly." 
            />
          </div>

          <div className="mt-20 text-center">
            <Link to="/auth" className="inline-flex items-center gap-2 text-blue-600 font-bold hover:gap-3 transition-all group">
              Start Protecting Yourself Now <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-100 hover:border-blue-200 transition-colors">
      <div className="mb-6">{icon}</div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ num, icon, title, desc }: { num: string, icon: React.ReactNode, title: string, desc: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="p-8 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col items-center text-center group hover:bg-white hover:shadow-xl hover:shadow-slate-200/50 hover:border-blue-200 transition-all duration-300 pointer-events-auto"
    >
      <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-blue-600 mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600/50 mb-2">Step {num}</span>
      <h4 className="text-xl font-bold text-slate-900 mb-4">{title}</h4>
      <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
    </motion.div>
  );
}
