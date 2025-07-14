export default function Spacer({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'my-6',
    md: 'my-12',
    lg: 'my-20',
  };
  return <div className={sizes[size]} />;
}
