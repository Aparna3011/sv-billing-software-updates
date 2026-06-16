import { useParams } from 'react-router-dom';
import DocumentForm from '../_shared/DocumentForm';

export default function InvoiceEdit() {
  const { id } = useParams();
  return <DocumentForm type="invoice" recordId={id} />;
}
