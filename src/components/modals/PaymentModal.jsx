import PaymentForm from '../../pages/Payments/PaymentForm';
import Modal from './Modal';

export default function PaymentModal({
  open,
  onClose,
  invoiceId,
  payment,
}) {

  return (

    <Modal
      open={open}
      title={
        payment
          ? 'Edit Payment'
          : 'Record Payment'
      }
      onClose={onClose}
    >

      <PaymentForm
        invoiceId={invoiceId}
        payment={payment}
        compact
        onSaved={onClose}
      />

    </Modal>

  );

}