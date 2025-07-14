import { X } from "lucide-react";

export default function Cross({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-red-600">
      <X className="w-4 h-4" />
      <span>{label}</span>
    </div>
  );
}