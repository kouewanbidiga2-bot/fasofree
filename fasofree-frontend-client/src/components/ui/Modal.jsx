import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '../../utils/cn';

/**
 * Modale FasoFree — primitif Radix Dialog habillé avec les tokens du thème.
 *
 * Apporte SANS changer le visuel : fermeture Échap, verrouillage du scroll
 * en arrière-plan (modal), piège de focus, portail au-dessus de tout,
 * ARIA correct (rôle dialog étiqueté par `ModalTitle`).
 *
 * `overlayClassName` / `panelClassName` REMPLACENT les classes par défaut
 * (pas de cumul, aucune collision Tailwind) : chaque modale conserve
 * exactement son apparence d'origine.
 *
 * Usage :
 *   <Modal isOpen={open} onClose={close}>
 *     <ModalTitle asChild><h3 className="…">Titre</h3></ModalTitle>
 *     …contenu identique à avant…
 *   </Modal>
 */
const Modal = ({
  isOpen,
  onClose,
  children,
  overlayClassName = 'bg-black/40',
  panelClassName = 'bg-background-card w-full max-w-md mx-4 p-6',
  modal = true,
}) => (
  <Dialog.Root
    open={isOpen}
    onOpenChange={(o) => {
      if (!o) onClose();
    }}
    modal={modal}
  >
    <Dialog.Portal>
      <Dialog.Overlay
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in',
          overlayClassName,
        )}
      >
        <Dialog.Content
          className={cn('outline-none animate-scale-in', panelClassName)}
          aria-describedby={undefined}
        >
          {children}
        </Dialog.Content>
      </Dialog.Overlay>
    </Dialog.Portal>
  </Dialog.Root>
);

/**
 * Titre de modale — à poser sur le titre EXISTANT via `asChild` pour
 * conserver le balisage et le visuel exact tout en étiquetant la modale.
 */
const ModalTitle = Dialog.Title;

export default Modal;
export { Modal, ModalTitle };
