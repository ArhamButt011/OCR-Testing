import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    console.log('url-> ',url)

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'stored-url.txt');

    await fs.writeFile(filePath, url);
    return NextResponse.json({ message: 'Base URL saved successfully' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: `Failed to write file ${error}` }, { status: 500 });
  }
}
