import React from 'react'
import { FilterFields } from '@/types';
import { IoCalendar } from "react-icons/io5";

type Props = {
  filters: FilterFields;
  setFilters: React.Dispatch<React.SetStateAction<FilterFields>>;
};

const PODFilter: React.FC<Props> = ({ filters, setFilters }) => {


const filterFieldLabels: { key: keyof FilterFields; label: string; type?: 'date' | 'text' }[] = [
  { key: 'file_id', label: 'File ID' },
  { key: 'crtd_usr_cd', label: 'Created By' },
  { key: 'crtd_dtt', label: 'Created Date', type: 'date' },
  { key: 'sent_file_dtt', label: 'Sent File Date', type: 'date' },
  { key: 'ocr_bolno', label: 'BOL No' },
  { key: 'ocr_issqty', label: 'Issued Quantity' },
  { key: 'ocr_rcvqty', label: 'Received Quantity' },
  { key: 'ocr_stmp_sign', label: 'Stamped Signature' },
  { key: 'ocr_symt_none', label: 'SYM None' },
  { key: 'ocr_symt_damg', label: 'SYM Damaged' },
  { key: 'ocr_symt_shrt', label: 'SYM Short' },
  { key: 'ocr_symt_orvg', label: 'SYM Overaged' },
  { key: 'ocr_symt_refs', label: 'SYM Refs' },
  { key: 'ocr_symt_seal', label: 'SYM Seal' },
  { key: 'recv_data_dtt', label: 'Received Date', type: 'date' },
  { key: 'uptd_usr_cd', label: 'Updated By' },
  { key: 'uptd_dtt', label: 'Updated Date', type: 'date' },
  { key: 'ocr_stmp_pod_dtt', label: 'POD Date', type: 'date' },
  // { key: 'rnum', label: 'RNUM' },
];

console.log('filters-> ', filters)

  return (
   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">

      {filterFieldLabels.map(({ key, label, type }) => (
        <div key={key} >
           <label htmlFor={key}  className='text-black'>
            {label}
          </label>

          {type === "date" ? (
            <div className="relative">
              <input
                id={`${key}_input`}
                type="date"
                placeholder="YYYY-MM-DD"
                value={filters[key] || ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] custom-date-input"
                max="9999-12-31"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                onClick={() => {
                  const dateInput = document.getElementById(`${key}_input`) as HTMLInputElement;
                  if (dateInput) {
                    dateInput.showPicker();
                  }
                }}
              >
                <IoCalendar size={20} className="text-[#005B97]" />
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={filters[key] || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  [key]: e.target.value,
                }))
              }
                className="w-full px-4 py-2 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] custom-date-input"
              placeholder={`Enter ${label}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export default PODFilter