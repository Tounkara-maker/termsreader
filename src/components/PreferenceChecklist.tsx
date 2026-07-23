import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

interface Preference {
  id: string;
  label: string;
  description: string;
  checked: boolean;
}

const ppElements: Preference[] = [
  { id: "pp_data_collection", label: "Data Collection", description: "I agree to collection of personal data for product functionality.", checked: true },
  { id: "pp_third_party", label: "Partner Sharing", description: "I accept sharing my data with trusted business partners.", checked: false },
  { id: "pp_marketing", label: "Marketing Opt-in", description: "I consent to receive marketing emails and personalized offers.", checked: false },
  { id: "pp_cookies", label: "Full Cookie Access", description: "I accept all cookies, including tracking and advertising cookies.", checked: true },
  { id: "pp_location", label: "Location Services", description: "I agree to provide persistent location data for personalized services.", checked: false },
  { id: "pp_public_profile", label: "Public Visibility", description: "I accept that some profile information may be public by default.", checked: true },
  { id: "pp_retention", label: "Long-term Storage", description: "I consent to my data being stored for more than 2 years.", checked: true },
  { id: "pp_ai_training", label: "AI Model Training", description: "I agree to my data being used to train internal AI models.", checked: false },
];

const tcElements: Preference[] = [
  { id: "tc_arbitration", label: "Forced Arbitration", description: "I accept mandatory arbitration for all legal disputes.", checked: false },
  { id: "tc_no_class_action", label: "Class Action Waiver", description: "I waive my right to participate in any class action lawsuits.", checked: false },
  { id: "tc_termination", label: "Sudden Termination", description: "I agree that the service can terminate my account without notice.", checked: true },
  { id: "tc_content_license", label: "Content Licensing", description: "I grant the service a broad non-exclusive license to use my content.", checked: true },
  { id: "tc_liability_limit", label: "Liability Limits", description: "I accept significant limitations on the service's legal liability.", checked: true },
  { id: "tc_auto_renew", label: "Automatic Renewals", description: "I accept automatic subscription renewals and pre-authorized payments.", checked: true },
  { id: "tc_notice_change", label: "Terms Updates", description: "I agree that terms can be changed without direct individual notification.", checked: true },
  { id: "tc_governing_law", label: "International Jurisdiction", description: "I accept that international laws may govern our legal relationship.", checked: true },
];

export default function PreferenceChecklist({ 
  initialPreferences, 
  onSave 
}: { 
  initialPreferences?: any, 
  onSave?: (prefs: any) => void 
}) {
  const [preferences, setPreferences] = useState<{ pp: Preference[], tc: Preference[] }>(() => {
    // Helper to merge DB state into default elements
    const merge = (defaults: Preference[], saved: any[] | undefined) => {
      if (!saved || saved.length === 0) return defaults;
      return defaults.map(d => {
        const found = saved.find(s => s.id === d.id);
        return found ? { ...d, checked: found.checked } : d;
      });
    };

    if (initialPreferences) {
      return {
        pp: merge(ppElements, initialPreferences.pp),
        tc: merge(tcElements, initialPreferences.tc)
      };
    }
    return {
      pp: ppElements,
      tc: tcElements
    };
  });

  const toggle = (category: 'pp' | 'tc', id: string) => {
    const newPrefs = {
      ...preferences,
      [category]: preferences[category].map(p => p.id === id ? { ...p, checked: !p.checked } : p)
    };
    setPreferences(newPrefs);
    onSave?.(newPrefs);
  };

  return (
    <div className="space-y-10">
      <div>
        <h3 className="text-xs uppercase font-bold text-blue-600 tracking-widest mb-6">Privacy Policy Commons</h3>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
          {preferences.pp.map((p) => (
            <PreferenceItem key={p.id} item={p} onToggle={() => toggle('pp', p.id)} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase font-bold text-emerald-600 tracking-widest mb-6">Terms & Conditions Commons</h3>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
          {preferences.tc.map((p) => (
            <PreferenceItem key={p.id} item={p} onToggle={() => toggle('tc', p.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PreferenceItem({ item, onToggle }: { item: Preference, onToggle: () => void }) {
  return (
    <label className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 cursor-pointer group transition-colors">
      <input 
        type="checkbox" 
        checked={item.checked} 
        onChange={onToggle}
        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all"
      />
      <div className="flex flex-col">
        <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{item.label}</span>
        <span className="text-[11px] text-slate-400 font-medium leading-tight">{item.description}</span>
      </div>
    </label>
  );
}
