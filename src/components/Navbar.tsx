import { Link, useNavigate } from "react-router-dom";
import { LogOut, Chrome } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 sticky top-0 z-50">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 flex items-center justify-center">
            <img 
              src="/logo.svg" 
              alt="Termsreader Logo" 
              className="w-8 h-8 object-contain select-none" 
            />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800">Termsreader</span>
        </Link>
        <div className="hidden md:flex items-center gap-6">
          <div className="flex gap-4 text-sm font-medium text-slate-600">
            <Link to="/pricing" className="hover:text-blue-600 transition-colors">Pricing</Link>
            {user && (
              <Link to="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</Link>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <button 
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
                <Link to="/dashboard" className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xs hover:opacity-90 transition-all shadow-sm">
                  {(user?.email?.charAt(0) || "U").toUpperCase()}
                </Link>
              </>
            ) : (
              <Link 
                to="/auth" 
                className="px-5 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
