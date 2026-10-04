import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="This page doesn't exist." />
      <Link to="/" className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-400">
        Go to Dashboard
      </Link>
    </>
  );
}
