export interface OracleRow {
  OCR_BOLNO: string;
  FILE_NAME: string;
  FILE_ID: string;
  OCR_STMP_SIGN: string;
  OCR_ISSQTY: number;
  OCR_RCVQTY: number;
  OCR_SYMT_DAMG: string;
  OCR_SYMT_SHRT: string;
  OCR_SYMT_ORVG: string;
  OCR_SYMT_REFS: string;
  OCR_STMP_POD_DTT: string;
  CRTD_DTT: Date;
  OCR_SYMT_SEAL: string;
  OCR_SYMT_NONE: string;
  UPTD_USR_CD: string;
}
export interface PodFile {
  FILE_ID: string;
  FILE_TABLE: string;
  CRTD_DTT:Date;
  FILE_NAME: string;
}
