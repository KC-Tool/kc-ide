import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';

/** 弹窗进出场动画时长（overlay 与 panel 共用，保证同步） */
export const MODAL_ANIMATION_MS = 220;

const ModalContext = createContext<(() => void) | null>(null);

/** 在 Modal 内触发带退出动画的关闭 */
export function useModalClose(): () => void {
  const close = useContext(ModalContext);
  if (!close) {
    throw new Error('useModalClose must be used within Modal');
  }
  return close;
}

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
  closeOnOverlayClick?: boolean;
  role?: string;
  ariaLabelledby?: string;
}

export default function Modal({
  onClose,
  children,
  overlayClassName,
  panelClassName,
  closeOnOverlayClick = true,
  role = 'dialog',
  ariaLabelledby,
}: ModalProps) {
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, MODAL_ANIMATION_MS);
  }, [closing, onClose]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose]);

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!closeOnOverlayClick || closing) return;
    if (e.target === e.currentTarget) requestClose();
  };

  const overlayClass = [
    'modal-overlay',
    closing ? 'modal-overlay-exit' : 'modal-overlay-enter',
    overlayClassName,
  ].filter(Boolean).join(' ');

  const panelClass = [
    'modal',
    closing ? 'modal-exit' : 'modal-enter',
    panelClassName,
  ].filter(Boolean).join(' ');

  return (
    <ModalContext.Provider value={requestClose}>
      <div className={overlayClass} onClick={handleOverlayClick}>
        <div
          className={panelClass}
          role={role}
          aria-labelledby={ariaLabelledby}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  );
}
