export interface Job {
    _id: string;
    selectedDays: string[];
    fromTime: string | null;
    fetchLimit:number;
    toTime: string | null;
    everyTime: string;
    active: boolean;
    dayOffset:number;
  }
  

  export interface FilterFields {
  file_id: string;
  crtd_usr_cd: string;
  crtd_dtt: string;
  sent_file_dtt: string;
  ocr_bolno: string;
  ocr_issqty: string;
  ocr_rcvqty: string;
  ocr_stmp_sign: string;
  ocr_symt_none: string;
  ocr_symt_damg: string;
  ocr_symt_shrt: string;
  ocr_symt_orvg: string;
  ocr_symt_refs: string;
  ocr_symt_seal: string;
  recv_data_dtt: string;
  uptd_usr_cd: string;
  uptd_dtt: string;
  ocr_stmp_pod_dtt: string;
  rnum: string;
}