type DividerProps = {
  variant?: 'subtle' | 'solid' | 'inset' | 'dashed' | 'labeled';
  label?: string;
};

export default function Divider({ variant = 'subtle', label }: DividerProps) {
  const base = 'w-full border-t';

  const variantStyles: Record<string, string> = {
    solid: 'my-6 border-slate-300 dark:border-slate-600',
    inset: 'my-6 ml-6 w-[calc(100%-1.5rem)] border-slate-300 dark:border-slate-600',
    dashed: 'my-6 border-slate-300 border-dashed border-opacity-60 dark:border-slate-600 dark:border-opacity-50',
    labeled: 'my-10',
  };

  if (variant === 'labeled' && label) {
    return (
      <div className="relative my-10 flex items-center justify-center text-center">
        <hr className="flex-grow border-t border-slate-200 dark:border-slate-700 opacity-50" />
        <span
          className="
            mx-3
            shrink-0
            rounded
            bg-white
            px-3
            text-xs
            font-medium
            text-slate-500
            dark:bg-slate-900
            dark:text-slate-400
          "
        >
          {label}
        </span>
        <hr className="flex-grow border-t border-slate-200 dark:border-slate-700 opacity-50" />
      </div>
    );
  }
  if (variant === 'subtle') {
    return <div className="my-6" />;
  }

  return <hr className={`${base} ${variantStyles[variant]}`} />;
}


/* example usage -> <Divider />
<Divider variant="dashed" />
<Divider variant="inset" />
<Divider variant="labeled" label="Advanced Settings" /> */