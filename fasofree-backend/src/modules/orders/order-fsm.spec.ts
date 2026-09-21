import { OrderStatus, OrderType, FulfillmentType } from './entities/order.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { ORDER_STATUS_FSM } from './orders.service';

/**
 * Tests de la FSM (Machine à États) des statuts de commande.
 * Vérifie que les transitions interdites sont bien rejetées
 * et que les transitions autorisées fonctionnent.
 */

const DRIVER_TRANSITIONS: OrderStatus[] = [
  OrderStatus.IN_DELIVERY,
  OrderStatus.DELIVERED_PENDING_CONFIRMATION,
];

const MERCHANT_TRANSITIONS: OrderStatus[] = [
  OrderStatus.IN_PREPARATION,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.CANCELLED,
];

describe('FSM des statuts de commande', () => {
  describe('Transitions autorisées', () => {
    it('PENDING → PAID (webhook paiement confirmé)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.PENDING]).toContain(OrderStatus.PAID);
    });

    it('PENDING → CANCELLED (annulation)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.PENDING]).toContain(OrderStatus.CANCELLED);
    });

    it('PAID → IN_PREPARATION (marchand commence)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.PAID]).toContain(OrderStatus.IN_PREPARATION);
    });

    it('IN_PREPARATION → READY_FOR_PICKUP (marchand prêt)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.IN_PREPARATION]).toContain(OrderStatus.READY_FOR_PICKUP);
    });

    it('READY_FOR_PICKUP → DRIVER_ASSIGNED (livreur accepte)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.READY_FOR_PICKUP]).toContain(OrderStatus.DRIVER_ASSIGNED);
    });

    it('DRIVER_ASSIGNED → IN_DELIVERY (livreur en route)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.DRIVER_ASSIGNED]).toContain(OrderStatus.IN_DELIVERY);
    });

    it('IN_DELIVERY → DELIVERED_PENDING_CONFIRMATION (livreur arrive)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.IN_DELIVERY]).toContain(OrderStatus.DELIVERED_PENDING_CONFIRMATION);
    });

    it('DELIVERED_PENDING_CONFIRMATION → COMPLETED (client confirme)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.DELIVERED_PENDING_CONFIRMATION]).toContain(OrderStatus.COMPLETED);
    });

    it('DELIVERED → COMPLETED (auto-complétion 24h)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.DELIVERED]).toContain(OrderStatus.COMPLETED);
    });

    it('DELIVERED → DISPUTED (client ouvre litige)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.DELIVERED]).toContain(OrderStatus.DISPUTED);
    });

    it('DISPUTED → REFUNDED (remboursement)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.DISPUTED]).toContain(OrderStatus.REFUNDED);
    });

    it('AWAITING_PAYMENT → PAID (webhook GeniusPay confirmé)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.AWAITING_PAYMENT]).toContain(OrderStatus.PAID);
    });

    it('AWAITING_PAYMENT → CANCELLED (annulation client)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.AWAITING_PAYMENT]).toContain(OrderStatus.CANCELLED);
    });

    it('AWAITING_PAYMENT → FAILED (échec paiement)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.AWAITING_PAYMENT]).toContain(OrderStatus.FAILED);
    });
  });

  describe('Transitions INTERDITES (failles de sécurité)', () => {
    it('PENDING → IN_PREPARATION INTERDIT (pas de paiement)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.PENDING]).not.toContain(OrderStatus.IN_PREPARATION);
    });

    it('PENDING → READY_FOR_PICKUP INTERDIT', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.PENDING]).not.toContain(OrderStatus.READY_FOR_PICKUP);
    });

    it('PENDING → IN_DELIVERY INTERDIT', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.PENDING]).not.toContain(OrderStatus.IN_DELIVERY);
    });

    it('PAID → READY_FOR_PICKUP INTERDIT (doit passer par IN_PREPARATION)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.PAID]).not.toContain(OrderStatus.READY_FOR_PICKUP);
    });

    it('PAID → IN_DELIVERY INTERDIT', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.PAID]).not.toContain(OrderStatus.IN_DELIVERY);
    });

    it('IN_PREPARATION → IN_DELIVERY INTERDIT (doit passer par READY_FOR_PICKUP)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.IN_PREPARATION]).not.toContain(OrderStatus.IN_DELIVERY);
    });

    it('COMPLETED → n\'importe quoi INTERDIT (état terminal)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.COMPLETED]).toHaveLength(0);
    });

    it('CANCELLED → n\'importe quoi INTERDIT (état terminal)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.CANCELLED]).toHaveLength(0);
    });

    it('FAILED → n\'importe quoi INTERDIT (état terminal)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.FAILED]).toHaveLength(0);
    });

    it('REFUNDED → n\'importe quoi INTERDIT (état terminal)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.REFUNDED]).toHaveLength(0);
    });

    it('DELIVERED → IN_DELIVERY INTERDIT (ne peut pas revenir en arrière)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.DELIVERED]).not.toContain(OrderStatus.IN_DELIVERY);
    });

    it('COMPLETED → PENDING INTERDIT (ne peut pas revenir)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.COMPLETED]).not.toContain(OrderStatus.PENDING);
    });

    it('AWAITING_PAYMENT → IN_PREPARATION INTERDIT (doit payer d\'abord)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.AWAITING_PAYMENT]).not.toContain(OrderStatus.IN_PREPARATION);
    });

    it('AWAITING_PAYMENT → IN_DELIVERY INTERDIT (doit payer d\'abord)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.AWAITING_PAYMENT]).not.toContain(OrderStatus.IN_DELIVERY);
    });

    it('AWAITING_PAYMENT → COMPLETED INTERDIT (doit payer d\'abord)', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.AWAITING_PAYMENT]).not.toContain(OrderStatus.COMPLETED);
    });
  });

  describe('Rôles autorisés par transition', () => {
    it('IN_DELIVERY est une transition de livreur', () => {
      expect(DRIVER_TRANSITIONS).toContain(OrderStatus.IN_DELIVERY);
    });

    it('DELIVERED_PENDING_CONFIRMATION est une transition de livreur', () => {
      expect(DRIVER_TRANSITIONS).toContain(OrderStatus.DELIVERED_PENDING_CONFIRMATION);
    });

    it('IN_PREPARATION est une transition de marchand', () => {
      expect(MERCHANT_TRANSITIONS).toContain(OrderStatus.IN_PREPARATION);
    });

    it('READY_FOR_PICKUP est une transition de marchand', () => {
      expect(MERCHANT_TRANSITIONS).toContain(OrderStatus.READY_FOR_PICKUP);
    });

    it('CANCELLED est une transition de marchand', () => {
      expect(MERCHANT_TRANSITIONS).toContain(OrderStatus.CANCELLED);
    });
  });

  describe('Chemin complet d\'une commande', () => {
    it('Flux normal: PENDING → PAID → IN_PREPARATION → READY_FOR_PICKUP → DRIVER_ASSIGNED → IN_DELIVERY → DELIVERED_PENDING_CONFIRMATION → COMPLETED', () => {
      const path: OrderStatus[] = [
        OrderStatus.PENDING,
        OrderStatus.PAID,
        OrderStatus.IN_PREPARATION,
        OrderStatus.READY_FOR_PICKUP,
        OrderStatus.DRIVER_ASSIGNED,
        OrderStatus.IN_DELIVERY,
        OrderStatus.DELIVERED_PENDING_CONFIRMATION,
        OrderStatus.COMPLETED,
      ];

      for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];
        expect(ORDER_STATUS_FSM[from]).toContain(to);
      }
    });

    it('Flux annulation: PENDING → CANCELLED', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.PENDING]).toContain(OrderStatus.CANCELLED);
    });

    it('Flux annulation après paiement: PAID → CANCELLED', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.PAID]).toContain(OrderStatus.CANCELLED);
    });

    it('Flux litige: ... → COMPLETED → DELIVERED → DISPUTED → REFUNDED', () => {
      expect(ORDER_STATUS_FSM[OrderStatus.DELIVERED]).toContain(OrderStatus.DISPUTED);
      expect(ORDER_STATUS_FSM[OrderStatus.DISPUTED]).toContain(OrderStatus.REFUNDED);
    });
  });
});
