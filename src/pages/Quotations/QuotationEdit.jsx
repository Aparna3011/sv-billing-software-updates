import { useParams } from 'react-router-dom';
import DocumentForm from '../_shared/DocumentForm';

export default function QuotationEdit() {
  const { id } = useParams();
  return <DocumentForm type="quotation" recordId={id} />;
}
