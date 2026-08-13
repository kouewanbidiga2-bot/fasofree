export enum OrderStatus {
  PENDING = 'pending', // Commande créée, attente paiement
  PAID = 'paid', // Paiement validé
  PREPARING = 'preparing', // En préparation par le commerce
  READY = 'ready', // Prête, en attente de livreur
  PICKED_UP = 'picked_up', // Récupérée par le livreur
  DELIVERED = 'delivered', // Livrée au client
  CANCELLED = 'cancelled', // Annulée
}
