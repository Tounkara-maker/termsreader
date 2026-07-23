import { Chrome, Download, MousePointer2, Settings, ShieldCheck, ChevronRight } from "lucide-react";

export default function ExtensionHelp() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-16">
        <div className="inline-flex p-3 bg-blue-100 text-blue-600 rounded-2xl mb-6">
          <Chrome className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Chrome Extension Guide</h1>
        <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto">
          Currently, the extension is in developer preview. Follow these steps to install it on your computer and start analyzing policies directly from your browser.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-16">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm ring-2 ring-blue-500 ring-offset-4">
          <div className="bg-blue-500 text-white w-10 h-10 rounded-xl flex items-center justify-center mb-6 font-black shadow-lg shadow-blue-200">1</div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">Export Project ZIP</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
            Look at the <strong>top right corner</strong> of the AI Studio interface (outside this preview). Click the <strong>Settings</strong> or <strong>Export</strong> button and choose <strong>Export to ZIP</strong>.
          </p>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
             <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Download className="w-4 h-4 text-blue-600" />
             </div>
            <span className="text-xs font-bold text-slate-600">Click "Export to ZIP" in Top Menu</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center mb-6 font-black">2</div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">Extract & Find Folder</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
            Unzip the downloaded file on your computer. Inside, you will find a folder named <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 font-bold">/chrome-extension</code>. This contains the manifest and logic.
          </p>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Settings className="w-4 h-4" />
            Folder: /chrome-extension
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="bg-blue-50 text-blue-600 w-10 h-10 rounded-xl flex items-center justify-center mb-6 font-black">3</div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">Install in Chrome</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
            Go to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 font-bold">chrome://extensions/</code>, enable <strong>Developer mode</strong>, and click <strong>Load unpacked</strong>. Select that folder.
          </p>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <MousePointer2 className="w-4 h-4" />
            Instant Protection
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm ring-2 ring-emerald-500 ring-offset-4">
          <div className="bg-emerald-500 text-white w-10 h-10 rounded-xl flex items-center justify-center mb-6 font-black shadow-lg shadow-emerald-200">4</div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">One-Time Sync</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
            After installing, <strong>refresh this dashboard</strong>. The extension will automatically detect your login. This is a one-time step to sync your account.
          </p>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4" />
            Login Synced
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm opacity-60">
          <div className="bg-slate-100 text-slate-600 w-10 h-10 rounded-xl flex items-center justify-center mb-6 font-black">5</div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">Web Store Release</h3>
          <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
            When we launch, you can delete the "unpacked" folder and install directly from the store for auto-updates.
          </p>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Chrome className="w-4 h-4" />
            Coming Soon
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-4 tracking-tight">Coming to Chrome Web Store</h2>
          <p className="text-slate-400 font-medium max-w-xl mb-8 leading-relaxed">
            We are currently in the final stages of the Chrome Web Store review process. Soon, you'll be able to install Termsreader with a single click.
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-bold">Review in Progress</span>
            </div>
            <div className="bg-white/10 px-6 py-3 rounded-2xl border border-white/10 flex items-center gap-3">
              <span className="text-sm font-bold opacity-60">Estimated: Q2 2026</span>
            </div>
          </div>
        </div>
        <Chrome className="absolute -bottom-10 -right-10 w-64 h-64 text-white opacity-5 rotate-12" />
      </div>

      <div className="mt-16 text-center">
        <p className="text-slate-400 text-sm font-medium mb-6">Need help with installation? Contact our developer support team.</p>
        <button className="inline-flex items-center gap-2 text-blue-600 font-bold hover:gap-3 transition-all">
          Contact Support <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
