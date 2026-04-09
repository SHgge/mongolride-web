import type { Tables } from '../../types/database.types';
import ListingCard from './ListingCard';
import { Tag } from 'lucide-react';

type Listing = Tables<'listings'>;

interface ListingGridProps {
  listings: Listing[];
  loading: boolean;
}

export default function ListingGrid({ listings, loading }: ListingGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-gray-100 rounded-2xl h-72 animate-pulse" />
        ))}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="text-center py-20">
        <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Зар олдсонгүй</h3>
        <p className="text-gray-500 text-sm">Шүүлтүүрээ өөрчилж үзнэ үү</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  );
}
