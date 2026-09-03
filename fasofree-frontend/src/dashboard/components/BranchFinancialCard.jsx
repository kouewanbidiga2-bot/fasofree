import React from 'react';
import { Wallet, TrendingUp, TrendingDown, ShoppingBag, DollarSign } from 'lucide-react';

/**
 * Carte financière par agence
 * Affiche : solde wallet, revenus, commandes, commissions
 */
const BranchFinancialCard = ({
  branch,
  analytics,
  wallet,
  isSelected = false,
  onClick,
}) => {
  const revenue = analytics?.summary?.totalRevenue || 0;
  const orders = analytics?.summary?.totalOrders || 0;
  const commission = analytics?.summary?.platformCommission || 0;
  const netEarnings = analytics?.summary?.netEarnings || 0;
  const balance = wallet?.balance || 0;

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border cursor-pointer transition-all ${
        isSelected
          ? 'border-accent-primary bg-accent-primary/5 shadow-md'
          : 'border-border-light bg-background-card hover:border-accent-primary/40'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text-primary truncate">{branch.name}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <div className={`w-2 h-2 rounded-full ${branch.isOpen ? 'bg-status-success' : 'bg-status-error'}`} />
            <span className="text-[10px] text-text-tertiary">{branch.isOpen ? 'Ouvert' : 'Fermé'}</span>
          </div>
        </div>
        {isSelected && (
          <div className="w-6 h-6 rounded-full bg-accent-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-bold">✓</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-2.5 rounded-lg bg-background-secondary">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet size={11} className="text-accent-primary" />
            <span className="text-[10px] text-text-tertiary font-medium">Solde</span>
          </div>
          <p className="text-sm font-bold text-text-primary">{balance.toLocaleString()} <span className="text-[10px] font-normal text-text-tertiary">FCFA</span></p>
        </div>
        <div className="p-2.5 rounded-lg bg-background-secondary">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={11} className="text-status-success" />
            <span className="text-[10px] text-text-tertiary font-medium">Revenus</span>
          </div>
          <p className="text-sm font-bold text-text-primary">{revenue.toLocaleString()} <span className="text-[10px] font-normal text-text-tertiary">FCFA</span></p>
        </div>
        <div className="p-2.5 rounded-lg bg-background-secondary">
          <div className="flex items-center gap-1.5 mb-1">
            <ShoppingBag size={11} className="text-blue-500" />
            <span className="text-[10px] text-text-tertiary font-medium">Commandes</span>
          </div>
          <p className="text-sm font-bold text-text-primary">{orders}</p>
        </div>
        <div className="p-2.5 rounded-lg bg-background-secondary">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={11} className="text-orange-500" />
            <span className="text-[10px] text-text-tertiary font-medium">Net marchand</span>
          </div>
          <p className="text-sm font-bold text-text-primary">{netEarnings.toLocaleString()} <span className="text-[10px] font-normal text-text-tertiary">FCFA</span></p>
        </div>
      </div>
    </div>
  );
};

export default BranchFinancialCard;
