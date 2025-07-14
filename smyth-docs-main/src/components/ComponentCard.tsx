interface Props {
  name: string;
  description: string;
}
export default function ComponentCard({ name, description }: Props) {
  return (
    <div className="my-2 rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-800">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100">{name}</h4>
      <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  );
}
