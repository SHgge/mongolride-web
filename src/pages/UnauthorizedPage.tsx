import { Link } from 'react-router-dom';

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 className="text-4xl font-bold mb-4">403</h1>
      <p className="text-gray-600 mb-4">Хандах эрхгүй байна</p>
      <Link to="/" className="text-primary-600 hover:underline">Нүүр хуудас руу буцах</Link>
    </div>
  );
}
