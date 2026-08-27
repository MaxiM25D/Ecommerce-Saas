"use client";

type FilePickerProps = {
  accept: string;
  buttonLabel: string;
  description: string;
  id: string;
  multiple?: boolean;
  name: string;
  onChange: (files: File[]) => void;
  selectedNames: string[];
};

export function FilePicker({
  accept,
  buttonLabel,
  description,
  id,
  multiple = false,
  name,
  onChange,
  selectedNames,
}: FilePickerProps) {
  return (
    <div>
      <label
        className="group flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50 px-5 py-6 text-center transition hover:border-amber-500 hover:bg-amber-50/40 focus-within:border-amber-600 focus-within:ring-2 focus-within:ring-amber-200"
        htmlFor={id}
      >
        <input
          accept={accept}
          className="sr-only"
          id={id}
          multiple={multiple}
          name={name}
          onChange={(event) => onChange(Array.from(event.target.files ?? []))}
          type="file"
        />
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-xl text-amber-700 shadow-sm">
          ↑
        </span>
        <span className="mt-3 text-sm font-semibold text-stone-800">
          {buttonLabel}
        </span>
        <span className="mt-1 text-xs text-stone-500">{description}</span>
      </label>
      {selectedNames.length > 0 && (
        <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold">
            {selectedNames.length === 1
              ? "Archivo seleccionado"
              : `${selectedNames.length} archivos seleccionados`}
          </p>
          <p className="mt-1 truncate text-xs text-emerald-700">
            {selectedNames.join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}
