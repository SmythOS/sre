import { Check } from "lucide-react";

export default function Tick({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-green-600">
      <Check className="w-4 h-4" />
      <span>{label}</span>
    </div>
  );
}
