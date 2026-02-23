import { FileText } from "lucide-react";
import { type Contract, formatCurrency, formatDate } from "@/lib/mock-data";

interface ContractListProps {
  contracts: Contract[];
}

export function ContractList({ contracts }: ContractListProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
        <FileText size={16} /> 契約情報
      </h3>
      <div className="space-y-3">
        {contracts.map((contract) => (
          <div key={contract.id} className="rounded-lg bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800">{contract.contractType}</span>
              <span className="text-xs text-slate-500">{contract.company}</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>
                <span className="text-slate-400">開始日</span>
                <p className="font-medium">{formatDate(contract.startDate)}</p>
              </div>
              {contract.endDate && (
                <div>
                  <span className="text-slate-400">終了日</span>
                  <p className="font-medium">{formatDate(contract.endDate)}</p>
                </div>
              )}
              {contract.monthlyRate && (
                <div>
                  <span className="text-slate-400">月額</span>
                  <p className="font-medium text-blue-700">{formatCurrency(contract.monthlyRate)}</p>
                </div>
              )}
              {contract.hourlyRate && (
                <div>
                  <span className="text-slate-400">時給</span>
                  <p className="font-medium text-blue-700">{formatCurrency(contract.hourlyRate)}/h</p>
                </div>
              )}
            </div>
            {contract.note && (
              <p className="mt-1 text-xs text-slate-500">{contract.note}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
