import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="py-8 bg-white border-t border-slate-100 flex items-center shrink-0">
      <div className="max-w-7xl w-full mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex gap-8 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
          <Link to="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
          <Link to="/refund" className="hover:text-blue-600 transition-colors">Refund Policy</Link>
        </div>
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.1em]">
          © 2026 Termsreader
        </div>
      </div>
    </footer>
  );
}
