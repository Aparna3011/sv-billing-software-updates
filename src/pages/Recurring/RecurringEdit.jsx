import { useParams } from 'react-router-dom';
import RecurringForm from './RecurringForm';

export default function RecurringEdit() {
  const { id } = useParams();

  return <RecurringForm recordId={id} />;
}