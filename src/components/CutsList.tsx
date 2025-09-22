'use client';

interface Cut {
  s: number; // start time in seconds
  e: number; // end time in seconds
}

interface CutsListProps {
  cuts: Cut[];
  fmt: (t: number, showMs?: boolean) => string;
  onRemoveCut: (index: number) => void;
  onClearAll: () => void;
}

const CutsList = ({ cuts, fmt, onRemoveCut, onClearAll }: CutsListProps) => {
  console.log('📋 CutsList rendered with', cuts.length, 'cuts:', cuts); // Debug
  const hasCuts = cuts.length > 0;

  return (
    <div className="panel">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold m-0">Kesilen Saniyeler</h3>
        {hasCuts && (
          <button
            onClick={onClearAll}
            className="btn btn-warn"
            title="Tüm kesimleri geri al"
          >
            🗑️ Tümünü Temizle
          </button>
        )}
      </div>

      {!hasCuts ? (
        <div className="text-[#cdd6e5] opacity-80 py-4 text-center">
          Henüz kesim yok.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#223]">
                <th className="text-left p-2 text-sm text-[#cdd6e5]">#</th>
                <th className="text-left p-2 text-sm text-[#cdd6e5]">Başlangıç</th>
                <th className="text-left p-2 text-sm text-[#cdd6e5]">Bitiş</th>
                <th className="text-left p-2 text-sm text-[#cdd6e5]">Süre</th>
                <th className="text-left p-2 text-sm text-[#cdd6e5]"></th>
              </tr>
            </thead>
            <tbody>
              {cuts.map((cut, index) => {
                const duration = cut.e - cut.s;
                const showMsInTable = duration < 10; // Show ms for cuts shorter than 10s
                
                return (
                  <tr key={index} className="border-b border-[#223] hover:bg-[#131b28]">
                    <td className="p-2 text-sm">{index + 1}</td>
                    <td className="p-2">
                      <span className="text-sm font-mono">
                        {fmt(cut.s, showMsInTable)}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className="text-sm font-mono">
                        {fmt(cut.e, showMsInTable)}
                      </span>
                    </td>
                    <td className="p-2">
                      <span className="text-sm font-mono">
                        {fmt(duration, showMsInTable)}
                      </span>
                    </td>
                    <td className="p-2">
                      <button
                        onClick={() => onRemoveCut(index)}
                        className="btn btn-warn text-xs py-1 px-2"
                        title={`${cut.s.toFixed(1)}s - ${cut.e.toFixed(1)}s kesimini geri al`}
                      >
                        🗑️ Geri Al
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CutsList;

