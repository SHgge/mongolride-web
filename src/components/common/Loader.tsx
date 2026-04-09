interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export default function Loader({ size = 'md', className = '' }: LoaderProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${SIZES[size]} animate-spin rounded-full border-2 border-gray-300 border-t-primary-600`}
      />
    </div>
  );
}
