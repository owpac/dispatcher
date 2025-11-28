import React from "react";
import { Link, ArrowRight, MinusCircle } from "lucide-react";
import { SystemApplication } from "../types/applicationTypes";

interface RouteItemProps {
  id: string;
  url: string;
  condition: string;
  onUpdate: (id: string, field: string, value: string) => void;
  onDelete: (id: string) => void;
}

export const RouteItem: React.FC<RouteItemProps> = ({
  id,
  url,
  condition,
  onUpdate,
  onDelete,
}) => {
  return (
    <div className="group flex flex-col gap-2 mb-2 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* URL Row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-end w-8 text-text-secondary">
          <Link size={16} />
        </div>
        
        <div className="flex-1 flex gap-2">
          <div className="relative w-1/3 min-w-[120px]">
            <select
              className="w-full bg-input-bg text-text-primary text-sm rounded-md border border-border px-3 py-1.5 appearance-none focus:outline-none focus:border-accent transition-colors"
              value={condition}
              onChange={(e) => onUpdate(id, "condition", e.target.value)}
            >
              <option value="contains">Contains</option>
              <option value="startsWith">Starts with</option>
              <option value="regex">Regex</option>
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          <input
            type="text"
            className="flex-1 bg-input-bg text-text-primary text-sm rounded-md border border-border px-3 py-1.5 focus:outline-none focus:border-accent transition-colors placeholder-text-secondary/50"
            value={url}
            onChange={(e) => onUpdate(id, "url", e.target.value)}
            placeholder="e.g. meet.google.com"
          />
          
           <button
            onClick={() => onDelete(id)}
            className="text-text-secondary hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
            title="Remove route"
          >
            <MinusCircle size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
