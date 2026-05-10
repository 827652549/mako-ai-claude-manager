import { NextResponse } from 'next/server';
import { readClaudeMd } from '@/lib/claude-config';

export async function GET() {
  try {
    const content = await readClaudeMd();
    return NextResponse.json({ data: { content } });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          errorCode: 'error500',
          errorMsg: `Failed to read CLAUDE.md: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      },
      { status: 500 },
    );
  }
}
