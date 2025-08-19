import { NextResponse } from 'next/server';

type PDF = {
  name: string;
  url: string;
};

export async function GET() {
  try {
    const response = await fetch('https://hanneskonzept.ml-bench.com/public/api/pdf-files');

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch PDF data' }, { status: 500 });
    }

    const rawData = await response.text();

    const data = JSON.parse(rawData);

    const pdfs: PDF[] = data?.pdf_files || [];

    const validPdfs = pdfs.filter((pdf) => pdf.name && pdf.url);

    if (validPdfs.length === 0) {
      return NextResponse.json({ error: 'No valid PDFs found' }, { status: 404 });
    }

    const pdf = validPdfs[0];


    const responseData = {
      name: pdf.name,  
      url: pdf.url,  
    };

    return NextResponse.json(responseData, { status: 200 });

  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
