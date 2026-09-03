import React from 'react';
import { ChevronDown, MapPin, Check } from 'lucide-react';

/**
 * Sélecteur d'agences pour le dashboard marchand
 * Affiche la liste des agences de la marque avec switch
 */
const BranchSelector = ({ branches = [], selectedBranchId, onSelectBranch, loading }) => {
  const [open, setOpen] = React.useState(false);
  const dropdownRef = React.useRef(null);

  const selected = branches.find((b) => b.id === selectedBranchId);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="h-10 bg-background-secondary rounded-lg animate-pulse w-64" />
    );
  }

  if (!branches || branches.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 bg-background-card border border-border-light rounded-lg hover:border-accent-primary transition-colors text-sm font-medium text-text-primary min-w-[200px]"
      >
        <MapPin size={14} className="text-accent-primary flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {selected ? selected.name : 'Toutes les agences'}
        </span>
        <ChevronDown size={14} className={`text-text-tertiary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-background-card border border-border-light rounded-lg shadow-lg overflow-hidden">
          {/* Option "Toutes les agences" (vue marque) */}
          <button
            onClick={() => {
              onSelectBranch(null);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-background-secondary transition-colors ${
              !selectedBranchId ? 'bg-accent-primary/5 text-accent-primary' : 'text-text-primary'
            }`}
          >
            <div className="w-7 h-7 rounded-md bg-accent-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-accent-primary text-xs font-bold">TOUT</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">Vue Marque</p>
              <p className="text-xs text-text-tertiary">Toutes les agences</p>
            </div>
            {!selectedBranchId && <Check size={14} className="text-accent-primary" />}
          </button>

          <div className="border-t border-border-light" />

          {/* Liste des agences */}
          {branches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => {
                onSelectBranch(branch.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-background-secondary transition-colors ${
                selectedBranchId === branch.id ? 'bg-accent-primary/5 text-accent-primary' : 'text-text-primary'
              }`}
            >
              <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                branch.isOpen ? 'bg-status-success/10' : 'bg-status-error/10'
              }`}>
                <div className={`w-2 h-2 rounded-full ${branch.isOpen ? 'bg-status-success' : 'bg-status-error'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{branch.name}</p>
                <p className="text-xs text-text-tertiary truncate">{branch.address || 'Pas d\'adresse'}</p>
              </div>
              {selectedBranchId === branch.id && <Check size={14} className="text-accent-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchSelector;
